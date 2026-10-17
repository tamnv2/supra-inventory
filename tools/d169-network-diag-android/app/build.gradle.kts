plugins { id("com.android.application") }
android {
 namespace = "cd.cc.supra.diagnostic"
 compileSdk = 35
 defaultConfig {
  applicationId = "cd.cc.supra.diagnostic"
  minSdk = 26
  targetSdk = 35
  versionCode = 4
  versionName = "4.0.0"
 }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
