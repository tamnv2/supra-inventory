namespace SupraInventoryRelayAgent
{
    internal static class AgentConfig
    {
        internal const int AgentBuild = 6;
        internal const string ApiBaseUrl = "https://inventory-beta.supra.cc.cd";
        internal const string FirebaseProjectId = "supra-inventory-beta";
        internal const string FirebaseApiKey = "__FIREBASE_API_KEY_BETA__";
        internal const string DatabaseUrl = "https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app";
        internal const string FirestoreProbeUrl = "https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents";
        internal const string AppsScriptWebProbeUrl = "https://script.google.com/macros/s/office-probe/exec";
        internal const string AppsScriptApiProbeUrl = "https://script.googleapis.com/v1/projects";
        internal const string SheetsProbeUrl = "https://sheets.googleapis.com/v4/spreadsheets/office-probe";
        internal const string DriveProbeUrl = "https://www.googleapis.com/drive/v3/about?fields=user";
        internal const string WmsUiUrl = "https://wms-supra.winmart.vn/";
        internal const string WmsOrigin = "https://wms-supra.winmart.vn";
        internal const string WmsReferer = "https://wms-supra.winmart.vn/";
        internal const string WmsApiProbeUrl = "https://api-supra.winmart.vn/sft3-hy1/api/v1/warehouse/zones";
        internal const string WmsApiProbeSignPath = "/api/v1/warehouse/zones";
        internal const string CorporateProxyFallback = "http://proxyclientdr.winmart.vn:9090";
        internal const string GitHubReleasesApi = "https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30";
        internal const string AgentReleaseTagPrefix = "relay-agent-v";
        internal const string AgentExeAsset = "SUPRA-Inventory-Relay-Test.exe";
        internal const string AgentChecksumAsset = "SUPRA-Inventory-Relay-Test.exe.sha256";
    }
}
