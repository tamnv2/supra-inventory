namespace SupraInventoryRelayAgent
{
    internal static class AgentConfig
    {
        internal const int AgentBuild = 19;
        internal const string ApiBaseUrl = "https://inventory-beta.supra.cc.cd";
        internal const string FirebaseProjectId = "supra-inventory-beta";
        internal const string FirebaseApiKey = "__FIREBASE_API_KEY_BETA__";
        internal const string DatabaseUrl = "https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app";
        internal const string FirestoreDocumentsBaseUrl = "https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents";
        internal const string FirestoreProbeUrl = FirestoreDocumentsBaseUrl;
        internal const string FirestoreRelayCollectionUrl = FirestoreDocumentsBaseUrl + "/relay_poc_jobs";
        internal const string RelayTransport = "FIRESTORE_CONFIRM_V1";
        internal const string AppsScriptWebProbeUrl = "https://script.google.com/macros/s/office-probe/exec";
        internal const string AppsScriptApiProbeUrl = "https://script.googleapis.com/v1/projects";
        internal const string SheetsProbeUrl = "https://sheets.googleapis.com/v4/spreadsheets/office-probe";
        internal const string DriveProbeUrl = "https://www.googleapis.com/drive/v3/about?fields=user";
        internal const string WmsUiUrl = "https://wms-supra.winmart.vn/";
        internal const string WmsOrigin = "https://wms-supra.winmart.vn";
        internal const string WmsReferer = "https://wms-supra.winmart.vn/";
        internal const string WmsApiProbeUrl = "https://api-supra.winmart.vn/sft3-hy1/api/v1/warehouse/zones";
        internal const string WmsApiProbeSignPath = "/api/v1/warehouse/zones";
        internal const string WmsPicklistLookupUrl = "https://api-supra.winmart.vn/sft3-hy1/api/v1/autopp/pickListConfirms";
        internal const string WmsPicklistLookupSignPath = "/api/v1/autopp/pickListConfirms";
        internal const string WmsPicklistConfirmUrl = "https://api-supra.winmart.vn/sft3-hy1/api/v1/autopp/pickListConfirms/confirmSkipItem";
        internal const string WmsPicklistConfirmSignPath = "/api/v1/autopp/pickListConfirms/confirmSkipItem";
        internal const string WmsPicklistConfirmUiReferenceUrl = "https://wms-supra.winmart.vn/sft3/app/saleorder/auto-pickpack-confirm";
        internal const string CorporateProxyFallback = "http://proxyclientdr.winmart.vn:9090";
        internal const string GitHubReleasesApi = "https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30";
        internal const string AgentReleaseTagPrefix = "relay-agent-v";
        internal const string AgentExeAsset = "Agent.Auto.Confirm.Pick.Pack.exe";
        internal const string AgentChecksumAsset = "Agent.Auto.Confirm.Pick.Pack.exe.sha256";
    }
}
