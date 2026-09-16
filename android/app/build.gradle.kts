plugins {
    id("com.android.application")
}

fun quoted(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY")
    .orElse(System.getenv("FIREBASE_API_KEY_BETA") ?: "")
    .get()

android {
    namespace = "cd.cc.supra.inventory.beta"
    compileSdk = 36

    defaultConfig {
        applicationId = "cd.cc.supra.inventory.beta"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-beta"

        buildConfigField("String", "API_BASE_URL", quoted("https://inventory-beta.supra.cc.cd"))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(firebaseApiKey))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted("supra-inventory-beta"))
        buildConfigField("String", "FIREBASE_APP_ID", quoted("1:572322098890:android:3e483937876cbcc0400e33"))
        buildConfigField("String", "FIREBASE_MESSAGING_SENDER_ID", quoted("572322098890"))
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-messaging")
}
