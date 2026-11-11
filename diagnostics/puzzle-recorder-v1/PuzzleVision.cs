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

    // V2: in-memory visual geometry only; never inspect page DOM, requests, credentials or storage.
    // Fail closed when the yellow drag handle or the pair of similar puzzle contours is ambiguous.
    internal static class PuzzleVision
    {
        private sealed class Pair
        {
            internal CircleSegment Source, Target;
            internal double Score;
        }

        internal static PuzzlePrediction Analyze(byte[] png)
        {
            var result = new PuzzlePrediction();
            if (png == null || png.Length < 100) { result.Reason = "SCREENSHOT_EMPTY"; return result; }
            using (var color = Cv2.ImDecode(png, ImreadModes.Color))
            using (var mask = new Mat())
            using (var cleaned = new Mat())
            using (var gray = new Mat())
            using (var edges = new Mat())
            using (var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new OpenCvSharp.Size(3, 3)))
            {
                if (color.Empty()) { result.Reason = "SCREENSHOT_EMPTY"; return result; }
                result.Width = color.Cols;
                result.Height = color.Rows;
                // The visual button has a yellow tone; finding it from the actual screenshot
                // avoids depending on browser placement or viewport dimensions.
                Cv2.InRange(color, new Scalar(60, 172, 205), new Scalar(130, 230, 255), mask);
                Cv2.MorphologyEx(mask, cleaned, MorphTypes.Close, kernel);
                Cv2.FindContours(cleaned, out OpenCvSharp.Point[][] contours,
                    out HierarchyIndex[] _, RetrievalModes.External, ContourApproximationModes.ApproxSimple);
                var handles = new List<Tuple<Rect, double>>();
                foreach (var contour in contours)
                {
                    var box = Cv2.BoundingRect(contour);
                    if (box.Width < 32 || box.Width > 125 || box.Height < 27 || box.Height > 96) continue;
                    if ((double)box.Width / box.Height < 0.8 || (double)box.Width / box.Height > 2.2) continue;
                    var area = Cv2.ContourArea(contour);
                    if (area < 500 || area / (box.Width * box.Height) < 0.55) continue;
                    handles.Add(Tuple.Create(box, area));
                }
                if (handles.Count == 0) { result.Reason = "HANDLE_NOT_FOUND"; return result; }
                var rankedHandles = handles.OrderByDescending(h => h.Item2).ToList();
                if (rankedHandles.Count > 1 && rankedHandles[1].Item2 > rankedHandles[0].Item2 * 0.85)
                { result.Reason = "HANDLE_AMBIGUOUS"; return result; }
                var knob = rankedHandles[0].Item1;
                var knobX = knob.X + knob.Width / 2.0;
                var knobY = knob.Y + knob.Height / 2.0;
                var footerRight = DetectFooterRight(color, knob);
                Cv2.CvtColor(color, gray, ColorConversionCodes.BGR2GRAY);
                Cv2.Canny(gray, edges, 50, 110);
                var circles = Cv2.HoughCircles(gray, HoughModes.Gradient, 1.2, 20,
                    param1: 90, param2: 12, minRadius: 9, maxRadius: 21);
                if (circles == null || circles.Length < 2)
                { result.Reason = "PIECES_NOT_FOUND"; return result; }
                var sources = circles.Where(c => Math.Abs(c.Center.X - knobX) <= knob.Width * 0.28
                    && c.Center.Y >= knob.Y - knob.Height * 5.0
                    && c.Center.Y <= knob.Y - knob.Height * 2.45).ToList();
                var targets = circles.Where(c => c.Center.X > knobX + knob.Width * 1.3
                    && c.Center.X < footerRight - knob.Width * 0.2).ToList();
                var matches = new List<Pair>();
                foreach (var s in sources)
                    foreach (var t in targets)
                    {
                        if (Math.Abs(s.Center.Y - t.Center.Y) > Math.Max(8, s.Radius * .55)) continue;
                        if (Math.Abs(s.Radius - t.Radius) > 7) continue;
                        var srcShape = RectangleEdgeScore(edges, s);
                        var dstShape = RectangleEdgeScore(edges, t);
                        var family = SideCircleCount(circles, s) + SideCircleCount(circles, t);
                        var score = srcShape * 35 + dstShape * 35 + family * 7
                            - Math.Abs(s.Center.Y - t.Center.Y) * 2
                            - Math.Abs(s.Center.X - knobX) * 1.5;
                        matches.Add(new Pair { Source = s, Target = t, Score = score });
                    }
                result.Candidates = matches.Count;
                if (matches.Count == 0) { result.Reason = "PIECES_NOT_FOUND"; return result; }
                matches.Sort((a, b) => b.Score.CompareTo(a.Score));
                var first = matches[0];
                // Suppress competing, distinct target hypotheses rather than trying multiple drags.
                var rival = matches.Skip(1).FirstOrDefault(p =>
                    Math.Abs(p.Target.Center.X - first.Target.Center.X) > 24
                    || Math.Abs(p.Source.Center.Y - first.Source.Center.Y) > 15);
                if (first.Score < 46)
                { result.Reason = "IMAGE_CONFIDENCE_LOW"; result.Confidence = Math.Round(first.Score, 1); return result; }
                if (rival != null && first.Score - rival.Score < 9)
                { result.Reason = "IMAGE_AMBIGUOUS"; result.Confidence = Math.Round(first.Score, 1); return result; }
                result.StartX = (int)Math.Round(knobX);
                result.StartY = (int)Math.Round(knobY);
                result.TargetX = (int)Math.Round(first.Target.Center.X);
                result.DeltaX = (int)Math.Round(first.Target.Center.X - first.Source.Center.X);
                result.Confidence = Math.Round(first.Score, 1);
                if (result.DeltaX <= 0 || result.StartX + result.DeltaX >= result.Width - 5)
                { result.Reason = "DELTA_OUT_OF_BOUNDS"; return result; }
                result.Ready = true;
                result.Reason = "READY";
                return result;
            }
        }

        private static double RectangleEdgeScore(Mat edges, CircleSegment circle)
        {
            var x = circle.Center.X;
            var y = circle.Center.Y;
            var scale = circle.Radius / 14.0;
            var dx = 32 * scale;
            var dy = 75 * scale;
            var hits = 0;
            var total = 0;
            Action<double, double> sample = (xx, yy) =>
            {
                var px = (int)Math.Round(xx);
                var py = (int)Math.Round(yy);
                if (px < 3 || py < 3 || px >= edges.Cols - 3 || py >= edges.Rows - 3) return;
                total++;
                for (var oy = -2; oy <= 2; oy++)
                {
                    var found = false;
                    for (var ox = -2; ox <= 2; ox++)
                        if (edges.At<byte>(py + oy, px + ox) != 0) { found = true; break; }
                    if (found) { hits++; return; }
                }
            };
            for (var i = 14; i <= 68; i += 6)
            {
                sample(x - dx, y + i * scale);
                sample(x + dx, y + i * scale);
            }
            for (var i = -25; i <= 25; i += 8) sample(x + i * scale, y + dy);
            for (var i = -27; i <= 27; i += 7) sample(x + i * scale, y + 10 * scale);
            return total == 0 ? 0 : (double)hits / total;
        }

        private static int SideCircleCount(CircleSegment[] circles, CircleSegment top)
        {
            return circles.Count(v =>
                Math.Abs(v.Center.Y - (top.Center.Y + top.Radius * 2.7)) < 11
                && (Math.Abs(v.Center.X - (top.Center.X - top.Radius * 1.4)) < 11
                    || Math.Abs(v.Center.X - (top.Center.X + top.Radius * 2.9)) < 11));
        }

        private static int DetectFooterRight(Mat image, Rect knob)
        {
            var row = Math.Min(image.Rows - 1, knob.Y + 4);
            var right = knob.Right;
            var misses = 0;
            for (var x = knob.Right; x < Math.Min(image.Cols - 1, knob.X + knob.Width * 14); x++)
            {
                var rgb = image.At<Vec3b>(row, x);
                var low = Math.Min(rgb.Item0, Math.Min(rgb.Item1, rgb.Item2));
                var high = Math.Max(rgb.Item0, Math.Max(rgb.Item1, rgb.Item2));
                if (low > 205 && high - low < 29) { right = x; misses = 0; }
                else if (++misses > 20) break;
            }
            return right < knob.X + knob.Width * 2
                ? Math.Min(image.Cols - 5, knob.X + knob.Width * 9) : right;
        }
    }
}
