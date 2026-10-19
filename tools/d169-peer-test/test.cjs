const fs = require("node:fs");
const assert = require("node:assert/strict");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where,orderBy,serverTimestamp,Timestamp}=require("firebase/firestore");

(async()=>{
  const rules=fs.readFileSync("firebase/firestore.rules","utf8");
  if(!rules.includes("match /d169_diag_sessions/{sid}"))throw new Error("Missing isolated test namespace");
  const env=await initializeTestEnvironment({projectId:"demo-d169-isolated",firestore:{rules}});
  const sid="a1".repeat(16),adminId="test_admin",pickerId="test_picker",strangerId="test_stranger";
  const admin=env.authenticatedContext(adminId,{app_role:"ADMIN",app_base_role:"ADMIN",app_user_id:"admin_x",app_session_channel:"AGENT"}).firestore();
  const agentB=env.authenticatedContext("test_agent_b",{app_role:"ADMIN",app_base_role:"ADMIN",app_user_id:"agent_b",app_session_channel:"AGENT"}).firestore();
  const picker=env.authenticatedContext(pickerId,{app_role:"PICKER",app_user_id:"picker_x",app_session_generation:1,app_session_channel:"ANDROID"}).firestore();
  const stranger=env.authenticatedContext(strangerId,{app_role:"PICKER",app_user_id:"stranger_x",app_session_generation:1}).firestore();
  const secondPicker=env.authenticatedContext("second_picker",{app_role:"PICKER",app_user_id:"picker_y",app_session_generation:1}).firestore();
  const unauth=env.unauthenticatedContext().firestore();
  const root=`d169_diag_sessions/${sid}`;
  const future=Timestamp.fromDate(new Date(Date.now()+60*60*1000));
  const shortFuture=Timestamp.fromDate(new Date(Date.now()+30*1000));
  try{
    // Firestore missing-session GET is an authorized nonexistence result, not a network failure.
    const missing=await assertSucceeds(getDoc(doc(agentB,`d169_diag_sessions/${"ee".repeat(16)}`)));
    assert.equal(missing.exists(),false);
    await assertSucceeds(setDoc(doc(admin,root),{schema:"D169_DIAG_V1",owner_uid:adminId,paired_picker_uid:"",created_at:serverTimestamp(),expires_at:future,leader_uid:adminId,leader_node:"a3".repeat(16),leader_epoch:1,lease_until:shortFuture}));
    await assertSucceeds(setDoc(doc(admin,`${root}/members/${adminId}`),{uid:adminId,role:"ADMIN",joined_at:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(picker,root),{paired_picker_uid:pickerId}));
    await assertSucceeds(setDoc(doc(picker,`${root}/members/${pickerId}`),{uid:pickerId,role:"PICKER",joined_at:serverTimestamp()}));
    // Three-party phase readiness: each authenticated member may update only own ephemeral fields.
    await assertSucceeds(setDoc(doc(agentB,`${root}/members/test_agent_b`),{uid:"test_agent_b",role:"ADMIN",joined_at:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(admin,`${root}/members/${adminId}`),
      {ready_phase:0,ready_network:"NORMAL",ready_at:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(agentB,`${root}/members/test_agent_b`),
      {ready_phase:0,ready_network:"NORMAL",ready_at:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(picker,`${root}/members/${pickerId}`),
      {ready_phase:0,ready_network:"NORMAL",ready_at:serverTimestamp()}));
    await assertSucceeds(updateDoc(doc(admin,`${root}/members/${adminId}`),
      {ready_phase:1,ready_network:"OFFICE",ready_at:serverTimestamp()}));
    await assertFails(updateDoc(doc(picker,`${root}/members/${pickerId}`),
      {ready_phase:1,ready_network:"OFFICE",ready_at:serverTimestamp()}));
    await assertFails(updateDoc(doc(admin,`${root}/members/test_agent_b`),
      {ready_phase:1,ready_network:"NORMAL",ready_at:serverTimestamp()}));
    await assertFails(updateDoc(doc(admin,`${root}/members/${adminId}`),
      {role:"PICKER",ready_phase:1,ready_at:serverTimestamp()}));
    await assertFails(updateDoc(doc(admin,`${root}/members/${adminId}`),
      {ready_phase:5,ready_network:"OFFICE",ready_at:serverTimestamp()}));
    await assertFails(getDoc(doc(secondPicker,root)));
    await assertFails(setDoc(doc(secondPicker,`${root}/members/second_picker`),{uid:"second_picker",role:"PICKER",joined_at:serverTimestamp()}));
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
    // The low-read polling path must be compatible with production-equivalent
    // scoped Rules and a server-side created_at filter (no all-day rescan).
    const recent=Timestamp.fromDate(new Date(Date.now()-60*1000));
    const bounded=query(collection(admin,`${root}/messages`),
      where("created_at",">=",recent),orderBy("created_at","asc"));
    const boundedResult=await assertSucceeds(getDocs(bounded));
    assert(boundedResult.docs.some(x=>x.id===msgid),"D171_WINDOWED_QUERY_LOST_CURRENT_MESSAGE");

    await assertFails(setDoc(doc(stranger,`${root}/messages/${"bb".repeat(16)}`),
      {...msg,request_id:"bb".repeat(16),sender_uid:strangerId,expires_at:Timestamp.fromDate(new Date(Date.now()+60*1000))}));
    await assertFails(setDoc(doc(picker,`${root}/messages/${"ee".repeat(16)}`),
      {...msg,request_id:"ee".repeat(16),sender_uid:adminId,expires_at:Timestamp.fromDate(new Date(Date.now()+60*1000))}));
    const ackId=msgid+"_"+adminId;
    await assertSucceeds(setDoc(doc(admin,`${root}/receipts/${ackId}`),
      {request_id:msgid,receiver_uid:adminId,receiver_role:"ADMIN",payload_echo:"1234",result:"ACK",created_at:serverTimestamp(),elapsed_ms:10,network_epoch:"test-1"}));
    await assertFails(setDoc(doc(picker,`${root}/receipts/${msgid+"_"+pickerId}`),
      {request_id:msgid,receiver_uid:pickerId,receiver_role:"PICKER",payload_echo:"1234",result:"ACK",created_at:serverTimestamp(),elapsed_ms:10,network_epoch:"test-1"}));
    await assertSucceeds(updateDoc(doc(admin,root),{lease_until:Timestamp.fromDate(new Date(Date.now()+55*1000))}));
    await assertFails(updateDoc(doc(admin,root),{leader_node:"b4".repeat(16),leader_epoch:2,
      lease_until:Timestamp.fromDate(new Date(Date.now()+50*1000))}));
    await env.withSecurityRulesDisabled(async context=> {
      await updateDoc(doc(context.firestore(),root),{lease_until:Timestamp.fromDate(new Date(Date.now()-1000))});
    });
    await assertSucceeds(updateDoc(doc(admin,root),{leader_node:"b4".repeat(16),leader_epoch:2,
      lease_until:Timestamp.fromDate(new Date(Date.now()+35*1000))}));
    // Two Test Agent instances signed in under the same Admin account must still
    // exchange simulated messages via unique node identities, not a production HA lease.
    const nodeA="a3".repeat(16),nodeB="b4".repeat(16),sameUidMsg="a5".repeat(16);
    await assertSucceeds(setDoc(doc(admin,`${root}/messages/${sameUidMsg}`),{
      ...msg,request_id:sameUidMsg,sender_uid:adminId,sender_role:"ADMIN",
      sender_node:nodeA,target_uid:adminId,
      expires_at:Timestamp.fromDate(new Date(Date.now()+3*60*1000))
    }));
    await assertSucceeds(setDoc(doc(admin,`${root}/receipts/${sameUidMsg+"_"+adminId+"_"+nodeB}`),{
      request_id:sameUidMsg,receiver_uid:adminId,receiver_role:"ADMIN",receiver_node:nodeB,payload_echo:"1234",
      result:"ACK",created_at:serverTimestamp(),elapsed_ms:12,network_epoch:"agent-1"
    }));
    await assertFails(setDoc(doc(admin,`${root}/receipts/${sameUidMsg+"_"+adminId+"_"+nodeA}`),{
      request_id:sameUidMsg,receiver_uid:adminId,receiver_role:"ADMIN",receiver_node:nodeA,payload_echo:"1234",
      result:"ACK",created_at:serverTimestamp(),elapsed_ms:12,network_epoch:"agent-1"
    }));
    // A second, non-paired Picker cannot impersonate the Agent as the ACK receiver.
    await assertFails(setDoc(doc(secondPicker,`${root}/receipts/${msgid}_second_picker`),{
      request_id:msgid,receiver_uid:"second_picker",receiver_role:"PICKER",payload_echo:"1234",
      result:"ACK",created_at:serverTimestamp(),elapsed_ms:10,network_epoch:"picker-2"
    }));
    // When Picker login generation is revoked, test traffic must also stop.
    await env.withSecurityRulesDisabled(async context=> {
      await setDoc(doc(context.firestore(),`picker_session_controls/${pickerId}`),{revoked_generation:1});
    });
    await assertFails(setDoc(doc(picker,`${root}/messages/${"bc".repeat(16)}`),{
      ...msg,request_id:"bc".repeat(16),expires_at:Timestamp.fromDate(new Date(Date.now()+60*1000))
    }));
    await assertFails(setDoc(doc(unauth,`${root}/messages/${"dd".repeat(16)}`),{...msg}));
    console.log("D171_THREE_PARTY_RULES_EMULATOR_PASS: scoped authenticated peers + immutable messages + anti-spoof receipts + production isolation");
  }finally{await env.cleanup();}
})().catch(e=>{console.error("D169_RULES_TEST_FAILED",e);process.exit(1)});
