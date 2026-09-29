plugins {
    id("com.android.application")
}

android {
    namespace = "cd.cc.supra.inventory.dnddiag"
    compileSdk = 36

    defaultConfig {
        applicationId = "cd.cc.supra.inventory.dnddiag"
        minSdk = 30
        targetSdk = 30
        versionCode = 1
        versionName = "1.0-dnddiag"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
