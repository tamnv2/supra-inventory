plugins { id("com.android.application") }
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val fireKey = providers.gradleProperty("FIREBASE_API_KEY").orElse(System.getenv("FIREBASE_API_KEY_BETA") ?: "").get()
android {
  namespace = "cd.cc.supra.inventory.beta"
  compileSdk = 36
  defaultConfig {
    applicationId = "cd.cc.supra.inventory.d169diagnostic"
    minSdk = 30
    targetSdk = 35
    versionCode = 999927
    versionName = "D171-DIAG-E027"
    buildConfigField("String", "API_BASE_URL", quoted("https://inventory.supra.cc.cd"))
    buildConfigField("String", "FIREBASE_API_KEY", quoted(fireKey))
    buildConfigField("String", "FIREBASE_PROJECT_ID", quoted("supra-inventory-beta"))
    buildConfigField("String", "FIREBASE_APP_ID", quoted("1:572322098890:android:3e483937876cbcc0400e33"))
    buildConfigField("String", "FIREBASE_MESSAGING_SENDER_ID", quoted("572322098890"))
    buildConfigField("String", "FIREBASE_RTDB_URL", quoted("https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app"))
    buildConfigField("String", "FIRESTORE_RELAY_COLLECTION_URL", quoted("https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents/relay_poc_jobs"))
    buildConfigField("String", "UPDATE_RELEASE_API", quoted("https://inventory.supra.cc.cd/downloads/pda/manifest"))
    buildConfigField("String", "TRUSTED_SIGNER_SHA256", quoted(""))
    buildConfigField("String", "DEFAULT_PICKER_PASSWORD", quoted(""))
  }
  buildFeatures { buildConfig = true }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
dependencies {
  implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
  implementation("com.google.firebase:firebase-auth")
  implementation("com.google.firebase:firebase-firestore")
  implementation("com.google.firebase:firebase-messaging")
  implementation("androidx.core:core:1.17.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
