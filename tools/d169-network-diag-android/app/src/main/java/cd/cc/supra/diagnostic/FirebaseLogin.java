package cd.cc.supra.diagnostic;
import java.net.*;
import java.io.*;
import org.json.JSONObject;
public final class FirebaseLogin {
  public static String authenticate(String key,String email,String password)throws Exception{
    if(key.isEmpty()||email.isEmpty()||password.isEmpty())throw new Exception("MISSING_LOGIN_FIELDS");
    String url="https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+URLEncoder.encode(key,"UTF-8");
    HttpURLConnection conn=(HttpURLConnection)new URL(url).openConnection();
    conn.setRequestMethod("POST");conn.setConnectTimeout(8000);conn.setReadTimeout(8000);conn.setDoOutput(true);
    conn.setRequestProperty("Content-Type","application/json; charset=utf-8");
    JSONObject payload=new JSONObject().put("email",email).put("password",password).put("returnSecureToken",true);
    try {
      try(OutputStream out=conn.getOutputStream()){out.write(payload.toString().getBytes("UTF-8"));}
      int code=conn.getResponseCode();
      if(code!=200)throw new Exception("AUTH_HTTP_"+code);
      ByteArrayOutputStream bytes=new ByteArrayOutputStream();
      try(InputStream in=conn.getInputStream()){byte[] buf=new byte[2048];int n;while((n=in.read(buf))!=-1&&bytes.size()<25000){bytes.write(buf,0,n);}}
      String id=new JSONObject(bytes.toString("UTF-8")).optString("idToken","");
      if(id.isEmpty())throw new Exception("AUTH_MISSING_ID_TOKEN");
      return id;
    } finally {conn.disconnect();}
  }
}
