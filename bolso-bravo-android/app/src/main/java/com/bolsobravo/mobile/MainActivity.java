package com.bolsobravo.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Frontend local: sem credenciais de banco e sem bridge JS privilegiada. */
public final class MainActivity extends Activity {
    private WebView view;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        view = new WebView(this);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        view.setWebViewClient(new WebViewClient());
        setContentView(view);
        view.loadUrl("file:///android_asset/index.html");
    }
    @Override public void onBackPressed() {
        if (view != null && view.canGoBack()) view.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (view != null) {view.destroy(); view=null;}
        super.onDestroy();
    }
}
