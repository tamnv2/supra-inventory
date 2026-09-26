namespace SupraInventoryRelayAgent
{
    internal static class AgentConfig
    {
        internal const int AgentBuild = 62;
        internal const string ApiBaseUrl = "https://inventory-beta.supra.cc.cd";
        internal const string FirebaseProjectId = "supra-inventory-beta";
        internal const string FirebaseApiKey = "__FIREBASE_API_KEY_BETA__";
        internal const string DatabaseUrl = "https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app";
        internal const string FirestoreDocumentsBaseUrl = "https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents";
        internal const string FirestoreProbeUrl = FirestoreDocumentsBaseUrl;
        internal const string FirestoreRelayCollectionUrl = FirestoreDocumentsBaseUrl + "/relay_poc_jobs";
        internal const string FirestorePickerPresenceUrl = FirestoreDocumentsBaseUrl + "/picker_presence_projection/current";
        internal const string FirestoreFleetMetricsUrl = FirestoreDocumentsBaseUrl + "/relay_fleet_metrics/current";
        internal const string RelayTransport = "FIRESTORE_CONFIRM_V1";
        internal const string AppsScriptWebProbeUrl = "https://script.google.com/macros/s/office-probe/exec";
        internal const string AppsScriptApiProbeUrl = "https://script.googleapis.com/v1/projects";
        internal const string SheetsProbeUrl = "https://sheets.googleapis.com/v4/spreadsheets/office-probe";
        internal const string DriveProbeUrl = "https://www.googleapis.com/drive/v3/about?fields=user";
        internal const string WmsPicklistConfirmUiReferenceUrl = "https://wms-supra.winmart.vn/sft3/app/saleorder/auto-pickpack-confirm";
        internal const string GitHubReleasesApi = "https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30";
        internal const string AgentUpdateManifestUrl = ApiBaseUrl + "/downloads/agent/manifest";
        internal const string AgentUpdateExeUrl = ApiBaseUrl + "/downloads/agent/latest";
        internal const string AgentUpdateChecksumUrl = ApiBaseUrl + "/downloads/agent/latest.sha256";
        internal const string AgentReleaseTagPrefix = "relay-agent-v";
        internal const string AgentExeAsset = "Agent.Auto.Confirm.Pick.Pack.exe";
        internal const string AgentChecksumAsset = "Agent.Auto.Confirm.Pick.Pack.exe.sha256";
        internal const string AgentBrowserBundleManifestUrl = ApiBaseUrl + "/downloads/agent/browser/manifest";
        internal const string AgentBrowserBundleUrl = ApiBaseUrl + "/downloads/agent/browser/latest";
        internal const string AgentBrowserBundleChecksumUrl = ApiBaseUrl + "/downloads/agent/browser/latest.sha256";
    }
}
