const fs = require("node:fs");
const assert = require("node:assert/strict");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,collection,getDocs,serverTimestamp,Timestamp}=require("firebase/firestore");

(async()=>{
  const rules=fs.readFileSync("firebase/firestore.rules","utf8");
  if(!rules.includes("match /d169_diag_sessions/{sid}"))throw new Error("Missing isolated test namespace");
  const env=await initializeTestEnvironment({projectId:"demo-d169-isolated",firestore:{rules}});
  const sid="a1".repeat(16),adminId="test_admin",pickerId="test_picker",strangerId="test_stranger";
  const admin=env.authenticatedContext(adminId,{app_role:"ADMIN",app_base_role:"ADMIN",app_user_id:"admin_x",app_session_channel:"AGENT"}).firestore();
  const picker=env.authenticatedContext(pickerId,{app_role:"PICKER",app_user_id:"picker_x",app_session_generation:1,app_session_channel:"ANDROID"}).firestore();
  const stranger=env.authenticatedContext(strangerId,{app_role:"PICKER",app_user_id:"stranger_x",app_session_generation:1}).firestore();
  const unauth=env.unauthenticatedContext().firestore();
  const root=`d169_diag_sessions/${sid}`;
  const future=Timestamp.fromDate(new Date(Date.now()+60*60*1000));
  const shortFuture=Timestamp.fromDate(new Date(Date.now()+30*1000));
  try{
    await assertSucceeds(setDoc(doc(admin,root),{schema:"D169_DIAG_V1",owner_uid:adminId,created_at:serverTimestamp(),expires_at:future,leader_uid:adminId,leader_epoch:1,lease_until:shortFuture}));
    await assertSucceeds(setDoc(doc(admin,`${root}/members/${adminId}`),{uid:adminId,role:"ADMIN",joined_at:serverTimestamp()}));
    await assertSucceeds(setDoc(doc(picker,`${root}/members/${pickerId}`),{uid:pickerId,role:"PICKER",joined_at:serverTimestamp()}));
    await assertFails(getDocs(collection(unauth,`${root}/messages`)));
    await assertFails(setDoc(doc(stranger,`${root}/members/${pickerId}`),{uid:pickerId,role:"PICKER",joined_at:serverTimestamp()}));
    await assertFails(setDoc(doc(picker,"relay_poc_coordination/primary_handoff"),{test:true}));
    const msgid="d2".repeat(16);
    const msg={request_id:msgid,sender_uid:pickerId,sender_role:"PICKER",target_uid:adminId,
      kind:"PICKLIST_SIM",payload:"1234",created_at:serverTimestamp(),expires_at:future};
    // 5-minute maximum: reject the hour-long message.
    await assertFails(setDoc(doc(picker,`${root}/messages/${msgid}`),msg));
    await assertSucceeds(setDoc(doc(picker,`${root}/messages/${msgid}`),{...msg,expires_at:Timestamp.fromDate(new Date(Date.now()+3*60*1000))}));
    await assertSucceeds(getDoc(doc(admin,`${root}/messages/${msgid}`)));
    await assertFails(setDoc(doc(stranger,`${root}/messages/${"bb".repeat(16)}`),
      {...msg,request_id:"bb".repeat(16),sender_uid:strangerId,expires_at:Timestamp.fromDate(new Date(Date.now()+60*1000))}));
    await assertFails(setDoc(doc(picker,`${root}/messages/${"ee".repeat(16)}`),
      {...msg,request_id:"ee".repeat(16),sender_uid:adminId,expires_at:Timestamp.fromDate(new Date(Date.now()+60*1000))}));
    const ackId=msgid+"_"+adminId;
    await assertSucceeds(setDoc(doc(admin,`${root}/receipts/${ackId}`),
      {request_id:msgid,receiver_uid:adminId,result:"ACK",created_at:serverTimestamp(),elapsed_ms:10,network_epoch:"test-1"}));
    await assertFails(setDoc(doc(picker,`${root}/receipts/${msgid+"_"+pickerId}`),
      {request_id:msgid,receiver_uid:pickerId,result:"ACK",created_at:serverTimestamp(),elapsed_ms:10,network_epoch:"test-1"}));
    // Two Test Agent instances signed in under the same Admin account must still
    // exchange simulated messages via unique node identities, not a production HA lease.
    const nodeA="a3".repeat(16),nodeB="b4".repeat(16),sameUidMsg="a5".repeat(16);
    await assertSucceeds(setDoc(doc(admin,`${root}/messages/${sameUidMsg}`),{
      ...msg,request_id:sameUidMsg,sender_uid:adminId,sender_role:"ADMIN",
      sender_node:nodeA,target_uid:adminId,
      expires_at:Timestamp.fromDate(new Date(Date.now()+3*60*1000))
    }));
    await assertSucceeds(setDoc(doc(admin,`${root}/receipts/${sameUidMsg+"_"+adminId+"_"+nodeB}`),{
      request_id:sameUidMsg,receiver_uid:adminId,receiver_node:nodeB,
      result:"ACK",created_at:serverTimestamp(),elapsed_ms:12,network_epoch:"agent-1"
    }));
    await assertFails(setDoc(doc(admin,`${root}/receipts/${sameUidMsg+"_"+adminId+"_"+nodeA}`),{
      request_id:sameUidMsg,receiver_uid:adminId,receiver_node:nodeA,
      result:"ACK",created_at:serverTimestamp(),elapsed_ms:12,network_epoch:"agent-1"
    }));
    await assertFails(setDoc(doc(unauth,`${root}/messages/${"dd".repeat(16)}`),{...msg}));
    console.log("D169_CANARY_RULES_EMULATOR_PASS: scoped authenticated peers + immutable messages + anti-spoof receipts + production isolation");
  }finally{await env.cleanup();}
})().catch(e=>{console.error("D169_RULES_TEST_FAILED",e);process.exit(1)});
