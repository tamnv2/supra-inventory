plugins { id("com.android.application") }
fun quoted(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val signingFile = System.getenv("OBPP_SIGNING_KEYSTORE_PATH")
val signingPass = System.getenv("OBPP_SIGNING_STORE_PASSWORD")
val signingAlias = System.getenv("OBPP_SIGNING_KEY_ALIAS")
val signingKeyPass = System.getenv("OBPP_SIGNING_KEY_PASSWORD")
val signingReady = listOf(signingFile, signingPass, signingAlias, signingKeyPass).all { !it.isNullOrBlank() }
android {
    signingConfigs {
        if (signingReady) create("obppRelease") {
            storeFile = file(signingFile!!)
            storePassword = signingPass
            keyAlias = signingAlias
            keyPassword = signingKeyPass
        }
    }
    namespace = "cd.cc.supra.obpp1291"
    compileSdk = 36
    defaultConfig {
        applicationId = "cd.cc.supra.obpp1291"
        minSdk = 30
        targetSdk = 36
        versionCode = (System.getenv("OBPP_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("OBPP_VERSION_NAME") ?: "0.1.0-code-only"
        buildConfigField("String", "API_BASE_URL", quoted(providers.gradleProperty("OBPP_API_BASE_URL").orElse("https://inventory.supra.cc.cd").get()))
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (signingReady) signingConfig = signingConfigs.getByName("obppRelease")
        }
    }
    testOptions { unitTests.isIncludeAndroidResources = true }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.work:work-runtime-ktx:2.10.4")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.17")
    testImplementation("androidx.work:work-testing:2.10.4")
}
