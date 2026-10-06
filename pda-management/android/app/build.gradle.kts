plugins {
    id("com.android.application")
}

fun quoted(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val appVersionCode = (System.getenv("PDA_MGMT_VERSION_CODE") ?: "1").toInt()
val appVersionName = System.getenv("PDA_MGMT_VERSION_NAME") ?: "0.1.0-beta"
val betaKeystorePath = System.getenv("BETA_KEYSTORE_PATH")
val betaKeystorePassword = System.getenv("BETA_KEYSTORE_PASSWORD")
val betaKeyAlias = System.getenv("BETA_KEY_ALIAS")
val betaKeyPassword = System.getenv("BETA_KEY_PASSWORD")
val betaSigningReady = listOf(betaKeystorePath, betaKeystorePassword, betaKeyAlias, betaKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "cc.supra.pdamanagement.beta"
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
        applicationId = "cc.supra.pdamanagement.beta"
        minSdk = 30
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
        buildConfigField("String", "API_BASE_URL", quoted("https://pda-beta.supra.cc.cd"))
        buildConfigField("String", "APP_SCOPE", quoted("PDA_MANAGEMENT"))
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
