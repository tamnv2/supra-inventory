using System;
using System.Collections.Generic;
using System.Linq;
using OpenCvSharp;

namespace SupraPuzzleRecorder
{
    internal sealed class PuzzlePrediction
    {
        internal bool Ready;
        internal string Reason = "NOT_DETECTED";
        internal int StartX, StartY, TargetX, DeltaX;
        internal int Width, Height, Candidates;
        internal double Confidence;
    }

    // V2: only pixels of the current WebView2 screenshot. No DOM, credentials or network data.
    // Infer scale and position from the live yellow handle; never reuse a historical drag delta.
    internal static class PuzzleVision
    {
        internal static PuzzlePrediction Analyze(byte[] png)
        {
            var result = new PuzzlePrediction();
            if (png == null || png.Length < 100) { result.Reason = "SCREENSHOT_EMPTY"; return result; }
            using (var image = Cv2.ImDecode(png, ImreadModes.Color))
            using (var mask = new Mat())
            using (var cleaned = new Mat())
            using (var gray = new Mat())
            using (var edges = new Mat())
            using (var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(3, 3)))
            {
                if (image.Empty()) { result.Reason = "SCREENSHOT_EMPTY"; return result; }
                result.Width = image.Width;
                result.Height = image.Height;

                // Locate the yellow slider square by color, size and filled rectangularity.
                Cv2.InRange(image, new Scalar(60, 172, 205), new Scalar(130, 230, 255), mask);
                Cv2.MorphologyEx(mask, cleaned, MorphTypes.Close, kernel);
                Cv2.FindContours(cleaned, out Point[][] contours, out HierarchyIndex[] _,
                    RetrievalModes.External, ContourApproximationModes.ApproxSimple);
                var handles = new List<Tuple<Rect, double>>();
                foreach (var contour in contours)
                {
                    var rect = Cv2.BoundingRect(contour);
                    if (rect.Width < 32 || rect.Width > 130 || rect.Height < 27 || rect.Height > 100) continue;
                    if ((double)rect.Width / rect.Height < .8 || (double)rect.Width / rect.Height > 2.2) continue;
                    var area = Cv2.ContourArea(contour);
                    if (area < 500 || area / (rect.Width * rect.Height) < .55) continue;
                    handles.Add(Tuple.Create(rect, area));
                }
                if (handles.Count == 0) { result.Reason = "HANDLE_NOT_FOUND"; return result; }
                handles.Sort((a, b) => b.Item2.CompareTo(a.Item2));
                if (handles.Count > 1 && handles[1].Item2 > handles[0].Item2 * .85)
                { result.Reason = "HANDLE_AMBIGUOUS"; return result; }
                var knob = handles[0].Item1;
                result.StartX = knob.X + knob.Width / 2;
                result.StartY = knob.Y + knob.Height / 2;
                Cv2.CvtColor(image, gray, ColorConversionCodes.BGR2GRAY);
                Cv2.Canny(gray, edges, 80, 150);

                // Find the lower white outline of the left puzzle piece above the handle.
                // The vertical search window scales with the *measured* control height.
                double strongest = 0;
                var bottom = -1;
                var rowStart = Math.Max(3, knob.Y - (int)Math.Round(knob.Height * 4.15));
                var rowEnd = Math.Min(image.Height - 4, knob.Y - (int)Math.Round(knob.Height * 2.45));
                for (var row = rowStart; row < rowEnd; row++)
                {
                    var hits = 0;
                    for (var x = knob.X; x < Math.Min(image.Width - 3, knob.Right); x++)
                    {
                        var found = false;
                        for (var dy = -2; dy <= 2 && !found; dy++)
                            if (edges.At<byte>(row + dy, x) > 0) found = true;
                        if (found) hits++;
                    }
                    var coverage = (double)hits / knob.Width;
                    if (coverage > strongest) { strongest = coverage; bottom = row; }
                }
                if (bottom < 0 || strongest < .65)
                { result.Reason = "SOURCE_OUTLINE_NOT_FOUND"; return result; }

                // Copy only a small, dynamically sized edge template of the left piece.
                // Search for the matching outline on the same visual row, to its right.
                var sourceX = Math.Max(0, knob.X - 1);
                var width = (int)Math.Round(knob.Width * 1.15);
                var height = (int)Math.Round(knob.Width * 1.10);
                var sourceY = bottom - height + 3;
                var searchX = sourceX + (int)Math.Round(knob.Width * 1.4);
                var searchEnd = Math.Min(image.Width - 3, knob.X + knob.Width * 8);
                var searchY = sourceY - (int)Math.Round(knob.Width * .2);
                var searchBottom = sourceY + height + (int)Math.Round(knob.Width * .2);
                if (sourceY < 0 || sourceX + width >= image.Width
                    || searchY < 0 || searchEnd - searchX < width
                    || searchBottom > image.Height)
                { result.Reason = "PUZZLE_OUT_OF_VIEW"; return result; }

                using (var sample = new Mat(edges, new Rect(sourceX, sourceY, width, height)))
                using (var region = new Mat(edges,
                    new Rect(searchX, searchY, searchEnd - searchX, searchBottom - searchY)))
                using (var correlation = new Mat())
                {
                    Cv2.MatchTemplate(region, sample, correlation, TemplateMatchModes.CCorrNormed);
                    Cv2.MinMaxLoc(correlation, out _, out double bestScore, out _, out Point bestAt);
                    var secondScore = 0.0;
                    // Ignore near-identical alignment shifts; distinct X hypotheses are unsafe.
                    var separation = Math.Max(20, knob.Width / 3);
                    var possibleTargets = 0;
                    for (var row = 0; row < correlation.Height; row++)
                        for (var col = 0; col < correlation.Width; col++)
                        {
                            var value = correlation.At<float>(row, col);
                            if (value >= .20 && Math.Abs(col - bestAt.X) > separation)
                            {
                                possibleTargets++;
                                if (value > secondScore) secondScore = value;
                            }
                        }
                    result.Candidates = possibleTargets + 1;
                    result.Confidence = Math.Round(bestScore * 100, 1);
                    if (bestScore < .23)
                    { result.Reason = "IMAGE_CONFIDENCE_LOW"; return result; }
                    if (bestScore - secondScore < .035)
                    { result.Reason = "IMAGE_AMBIGUOUS"; return result; }
                    var matchX = searchX + bestAt.X;
                    result.DeltaX = matchX - sourceX;
                    result.TargetX = result.StartX + result.DeltaX;
                    if (result.DeltaX <= knob.Width || result.TargetX >= image.Width - 5)
                    { result.Reason = "DELTA_OUT_OF_BOUNDS"; return result; }
                    result.Ready = true;
                    result.Reason = "READY";
                    return result;
                }
            }
        }

        // Small native image-processing self-test; synthetic patterns, never real WMS content.
        internal static bool SelfTest()
        {
            using (var fixture = new Mat(new Size(900, 520), MatType.CV_8UC3, new Scalar(90, 110, 125)))
            {
                Cv2.Rectangle(fixture, new Rect(80, 380, 52, 44),
                    new Scalar(90, 192, 230), -1);
                Action<int> draw = x =>
                {
                    Cv2.Rectangle(fixture, new Rect(x, 218, 52, 46),
                        new Scalar(247, 247, 247), 2);
                    Cv2.Circle(fixture, new Point(x + 26, 215), 12,
                        new Scalar(247, 247, 247), 2);
                    Cv2.Circle(fixture, new Point(x + 54, 238), 11,
                        new Scalar(247, 247, 247), 2);
                };
                draw(80);
                draw(235);
                Cv2.ImEncode(".png", fixture, out byte[] png);
                var result = Analyze(png);
                return result.Ready && Math.Abs(result.DeltaX - 155) <= 4;
            }
        }
    }
}
