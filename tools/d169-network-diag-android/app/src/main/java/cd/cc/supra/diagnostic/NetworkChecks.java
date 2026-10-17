package cd.cc.supra.diagnostic;
import android.os.Build;
import android.net.*;
import android.content.Context;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.*;
public final class NetworkChecks {
  private static final String FIRESTORE="https://firestore.googleapis.com/v1/projects/supra-inventory-beta/databases/(default)/documents/relay_poc_coordination/roles";
  private static final String RTDB="https://supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app/relay_poc/coordination/ha_liveness.json";
  private static final String[] HOSTS={"identitytoolkit.googleapis.com","securetoken.googleapis.com","firestore.googleapis.com","fcm.googleapis.com","inventory-beta.supra.cc.cd","supra-inventory-beta-default-rtdb.asia-southeast1.firebasedatabase.app"};
  private static long ms(long t){return (System.nanoTime()-t)/1000000;}
  private static String error(Exception e){String x=e.getClass().getSimpleName().toUpperCase(Locale.ROOT);if(x.contains("TIMEOUT"))return "TIMEOUT";if(x.contains("HOST"))return "DNS_ERROR";if(x.contains("SSL"))return "TLS_ERROR";if(x.contains("CONNECT"))return "CONNECT_ERROR";return "NETWORK_ERROR";}
  private static JSONObject item(String name,String type,String status,long delay,int code,int bytes)throws Exception{
    JSONObject j=new JSONObject().put("name",name).put("category",type).put("result",status).put("duration_ms",delay);
    if(code>0)j.put("http_status",code);if(bytes>=0)j.put("response_body_bytes",bytes);return j;
  }
  public static JSONObject get(String name,String type,String endpoint,String idToken,boolean sse)throws Exception{
    long t=System.nanoTime();HttpURLConnection h=null;
    try{
      h=(HttpURLConnection)new URL(endpoint).openConnection();
      h.setConnectTimeout(4500);h.setReadTimeout(sse?3500:4500);h.setInstanceFollowRedirects(false);
      if(!idToken.isEmpty())h.setRequestProperty("Authorization","Bearer "+idToken);
      h.setRequestProperty("Accept",sse?"text/event-stream":"application/json");
      int status=h.getResponseCode();String body="";int size=0;
      InputStream src=(status>=400)?h.getErrorStream():h.getInputStream();
      if(src!=null)try(InputStream stream=src){byte[] buf=new byte[1024];int n;while((n=stream.read(buf))>0&&size<65536){size+=n;if(sse){body+=new String(buf,0,n,"UTF-8");break;}}}
      String outcome=sse?(status==200&&body.contains("event:")?"SSE_FIRST_FRAME":"SSE_HTTP_"+status):status>=200&&status<300?"HTTP_OK":"HTTP_"+status;
      return item(name,type,outcome,ms(t),status,size);
    }catch(Exception e){return item(name,type,error(e),ms(t),0,-1);}
    finally{if(h!=null)h.disconnect();}
  }
  private static JSONObject dns(String host)throws Exception{
    long t=System.nanoTime();try{return item(host,"DNS","RESOLVED",ms(t),0,InetAddress.getAllByName(host).length);}
    catch(Exception e){return item(host,"DNS",error(e),ms(t),0,-1);}
  }
  private static String time(){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT);f.setTimeZone(TimeZone.getTimeZone("UTC"));return f.format(new Date());}
  private static String transport(Context c){
    try{ConnectivityManager m=(ConnectivityManager)c.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities n=m.getNetworkCapabilities(m.getActiveNetwork());if(n==null)return "UNKNOWN";if(n.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return "WIFI";if(n.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))return "CELLULAR";if(n.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))return "ETHERNET";return "OTHER";}catch(Exception e){return "UNKNOWN";}
  }
  public static JSONObject run(Context context,String idToken,String session,String node,String label)throws Exception{
    JSONObject doc=new JSONObject().put("format","SUPRA_DUAL_NETWORK_DIAGNOSTIC_V4").put("version","4.0.1-PDA-READONLY").put("node_role",node).put("test_session_id",session).put("network_label",label).put("android_sdk",Build.VERSION.SDK_INT).put("actual_transport",transport(context)).put("authenticated",!idToken.isEmpty()).put("started_at_utc",time());
    JSONArray probes=new JSONArray();
    for(String host:HOSTS){probes.put(dns(host));probes.put(get(host,"HTTPS","https://"+host+"/","",false));}
    probes.put(get("AUTH_READ_FIRESTORE","FIRESTORE",FIRESTORE,idToken,false));
    probes.put(get("AUTH_READ_RTDB","RTDB",RTDB,idToken,false));
    probes.put(get("AUTH_SSE_RTDB","RTDB_SSE",RTDB,idToken,true));
    probes.put(item("Peer ACK write/receipt","PEER_ACK","NOT_TESTED_NO_AUTHORIZED_CANARY",0,0,-1));
    probes.put(item("Native Firestore Listen","GRPC_LISTEN","NOT_TESTED",0,0,-1));
    probes.put(item("Actual Android FCM","FCM_DELIVERY","NOT_TESTED",0,0,-1));
    doc.put("probes",probes).put("finished_at_utc",time());
    doc.put("limitations",new JSONArray().put("Read-only. No WMS, Picklist, production HA or service writes.").put("No peer ACK, Firestore gRPC or actual push test.").put("No token, password, SSID, MAC, IP or raw response bodies exported."));
    return doc;
  }
}
