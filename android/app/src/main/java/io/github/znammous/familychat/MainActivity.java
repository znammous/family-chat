package io.github.znammous.familychat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createChatChannel();
    }

    // قناة رسائل المجلس: أولوية عالية (تظهر على الشاشة) بصوت واهتزاز.
    // إعدادات القناة تُثبَّت عند أول إنشاء، فأي تغيير لاحق يحتاج معرّف قناة جديداً
    private void createChatChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            "chat_messages", "رسائل المجلس", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("تنبيه عند وصول رسالة جديدة");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 300, 150, 300 });
        channel.enableLights(true);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
}
