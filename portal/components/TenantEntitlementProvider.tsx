"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type EntitlementState = {
  loading:boolean;
  status:string;
  trialStartedAt:string|null;
  trialEndsAt:string|null;
  plan:string|null;
  billingInterval:string|null;
  canUseAutomation:boolean;
  daysRemaining:number|null;
};

const defaultState:EntitlementState = {
  loading:true,
  status:"not_started",
  trialStartedAt:null,
  trialEndsAt:null,
  plan:null,
  billingInterval:null,
  canUseAutomation:true,
  daysRemaining:null
};

const EntitlementContext=createContext<EntitlementState>(defaultState);

export function TenantEntitlementProvider({children}:{children:React.ReactNode}){
  const [state,setState]=useState<EntitlementState>(defaultState);

  useEffect(()=>{
    let cancelled=false;

    async function load(){
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();

      if(!user){
        if(!cancelled) setState({...defaultState,loading:false,canUseAutomation:false});
        return;
      }

      const {data:membership}=await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id",user.id)
        .limit(1)
        .maybeSingle();

      if(!membership){
        if(!cancelled) setState({...defaultState,loading:false,canUseAutomation:false});
        return;
      }

      const {data:tenant}=await supabase
        .from("tenants")
        .select("subscription_status,trial_started_at,trial_ends_at,plan,billing_interval")
        .eq("id",membership.tenant_id)
        .maybeSingle();

      if(!tenant){
        if(!cancelled) setState({...defaultState,loading:false,canUseAutomation:false});
        return;
      }

      const now=Date.now();
      const trialEnd=tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : null;
      const effectiveStatus =
        tenant.subscription_status==="trialing" && trialEnd!==null && trialEnd<=now
          ? "expired"
          : tenant.subscription_status;

      const canUseAutomation =
        effectiveStatus==="active" ||
        (effectiveStatus==="trialing" && trialEnd!==null && trialEnd>now);

      const daysRemaining =
        effectiveStatus==="trialing" && trialEnd!==null
          ? Math.max(0,Math.ceil((trialEnd-now)/(24*60*60*1000)))
          : null;

      if(!cancelled){
        setState({
          loading:false,
          status:effectiveStatus,
          trialStartedAt:tenant.trial_started_at,
          trialEndsAt:tenant.trial_ends_at,
          plan:tenant.plan,
          billingInterval:tenant.billing_interval,
          canUseAutomation,
          daysRemaining
        });
      }
    }

    load();
    const timer=window.setInterval(load,60*1000);

    return ()=>{
      cancelled=true;
      window.clearInterval(timer);
    };
  },[]);

  const value=useMemo(()=>state,[state]);
  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useTenantEntitlement(){
  return useContext(EntitlementContext);
}
