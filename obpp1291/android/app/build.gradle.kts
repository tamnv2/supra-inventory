plugins { id("com.android.application") }
fun quoted(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
android {
    namespace = "cd.cc.supra.obpp1291"
    compileSdk = 36
    defaultConfig {
        applicationId = "cd.cc.supra.obpp1291"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-code-only"
        buildConfigField("String", "API_BASE_URL", quoted(providers.gradleProperty("OBPP_API_BASE_URL").orElse("https://inventory.supra.cc.cd").get()))
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies { testImplementation("junit:junit:4.13.2") }
