plugins {
    id("com.android.application")
}

fun quoted(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY")
    .orElse(System.getenv("FIREBASE_API_KEY_BETA") ?: "")
    .get()
val appVersionCode = (System.getenv("APP_VERSION_CODE") ?: "1").toInt()
val appVersionName = System.getenv("APP_VERSION_NAME") ?: "0.2.0-beta"
val betaKeystorePath = System.getenv("BETA_KEYSTORE_PATH")
val betaKeystorePassword = System.getenv("BETA_KEYSTORE_PASSWORD")
val betaKeyAlias = System.getenv("BETA_KEY_ALIAS")
val betaKeyPassword = System.getenv("BETA_KEY_PASSWORD")
val betaSigningReady = listOf(betaKeystorePath, betaKeystorePassword, betaKeyAlias, betaKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "cd.cc.supra.inventory.beta"
    compileSdk = 36

    signingConfigs {
        if (betaSigningReady) {
            create("betaRelease") {
                storeFile = file(betaKeystorePath!!)
                storePassword = betaKeystorePassword
                keyAlias = betaKeyAlias
                keyPassword = betaKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "cd.cc.supra.inventory.beta"
        minSdk = 30
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName

        buildConfigField("String", "API_BASE_URL", quoted("https://inventory-beta.supra.cc.cd"))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(firebaseApiKey))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted("supra-inventory-beta"))
        buildConfigField("String", "FIREBASE_APP_ID", quoted("1:572322098890:android:3e483937876cbcc0400e33"))
        buildConfigField("String", "FIREBASE_MESSAGING_SENDER_ID", quoted("572322098890"))
        buildConfigField("String", "UPDATE_RELEASE_API", quoted("https://api.github.com/repos/tamnv2/supra-inventory/releases/latest"))
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (betaSigningReady) signingConfig = signingConfigs.getByName("betaRelease")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core:1.17.0")
}
