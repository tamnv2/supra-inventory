namespace SupraInventoryRelayAgent
{
    internal static class AgentConfig
    {
        internal const int AgentBuild = 2;
        internal const string ApiBaseUrl = "https://inventory-beta.supra.cc.cd";
        internal const string FirebaseProjectId = "supra-inventory-beta";
        internal const string FirebaseApiKey = "__FIREBASE_API_KEY_BETA__";
        internal const string DatabaseUrl = "https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app";
        internal const string GitHubReleasesApi = "https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30";
        internal const string AgentReleaseTagPrefix = "relay-agent-v";
        internal const string AgentExeAsset = "SUPRA-Inventory-Relay-Test.exe";
        internal const string AgentChecksumAsset = "SUPRA-Inventory-Relay-Test.exe.sha256";
    }
}
