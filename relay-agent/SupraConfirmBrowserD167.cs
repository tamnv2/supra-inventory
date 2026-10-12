using System;
using System.Collections.Generic;
using System.Net.WebSockets;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class SupraConfirmBrowser
    {
        // D167: request a separate side tab starting at the registered WMS page in the existing
        // WebView2 user-controlled profile, never navigate/reload Confirm.
        // The bundled host keeps this exact child hidden and allows only a
        // scoped Excel download. No WMS credential or API header is inspected.
        internal int OpenD167HiddenSkuExportPage()
        {
            lock (_gate)
            {
                ThrowIfDisposed();
                if (_launchMode != BrowserLaunchMode.Agent || _port <= 0 ||
                    _socket == null || _socket.State != WebSocketState.Open)
                    throw new InvalidOperationException("D167_MANAGED_BROWSER_NOT_READY");
                var source = _json.Serialize(AgentConfig.WmsPicklistConfirmUiReferenceUrl + AgentConfig.WmsSkuSideTabFragment);
                var expression = "(() => { window.open(" + source +
                    ", '_blank'); return JSON.stringify({requested:true}); })()";
                // User gesture applies only to a read-only popup of the exact
                // allowlisted report page. The main Confirm page remains intact.
                CommandNoLock("Runtime.evaluate", new Dictionary<string, object>
                {
                    { "expression", expression },
                    { "returnByValue", true },
                    { "userGesture", true }
                }, TimeSpan.FromSeconds(5));
                _log("D167_SKU_BROWSER hidden_page=REQUESTED main_confirm_navigation=UNCHANGED");
                return _port;
            }
        }


    }
}
