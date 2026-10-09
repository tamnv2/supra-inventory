using System;
using System.Windows.Forms;
namespace SupraSkuRecorder
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args != null && Array.Exists(args,
                arg => string.Equals(arg, "--self-test-sku", StringComparison.Ordinal)))
            {
                Environment.ExitCode = SkuWorkbookSelfTest.Run();
                return;
            }
            if (args != null && Array.Exists(args,
                arg => string.Equals(arg, "--self-test-export", StringComparison.Ordinal)))
            {
                Environment.ExitCode = RecorderSelfTest.Run();
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new RecorderForm());
        }
    }
}
