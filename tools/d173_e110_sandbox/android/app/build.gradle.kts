plugins { id("com.android.application") }
android {
    namespace = "com.supra.m2lab.pda"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.supra.m2lab.pda"
        minSdk = 26
        targetSdk = 32
        versionCode = 1
        versionName = "0.1.0-LAB"
    }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
dependencies { implementation("com.squareup.okhttp3:okhttp:4.12.0") }
