-- Run after creating a development user. Replace the UUID once; data is clearly demo-only.
do $$ declare demo_user uuid := '00000000-0000-0000-0000-000000000001'; para uuid := gen_random_uuid(); radiology uuid := gen_random_uuid(); begin
  if exists(select 1 from auth.users where id=demo_user) then
    insert into profiles(id,display_name) values(demo_user,'Demo Operator') on conflict(id) do nothing;
    insert into projects(id,user_id,name,description,status,color,target_date,progress,priority) values
      (para,demo_user,'Para Officinal','Demo commerce platform and operational tooling.','active','#3157D5',current_date+9,72,'urgent'),
      (radiology,demo_user,'Radiology Center','Demo campaign and client approval workspace.','active','#A46222',current_date+15,48,'high');
    insert into tasks(user_id,title,status,priority,project_id,due_date,estimated_minutes) values
      (demo_user,'Finish checkout validation','in_progress','urgent',para,current_date,90),
      (demo_user,'Approve campaign concept','planned','high',radiology,current_date,35),
      (demo_user,'Send client follow-up','waiting','high',radiology,current_date,15),
      (demo_user,'Plan weekly workouts','planned','medium',null,current_date+1,20);
    insert into waiting_items(user_id,title,project_id,requested_at,expected_by,contact) values(demo_user,'Waiting for campaign approval',radiology,now()-interval '4 days',now()-interval '1 day','Radiology Center');
    insert into goals(user_id,title,period,target_date,progress) values(demo_user,'Ship Para Officinal v1','month',current_date+27,72),(demo_user,'Run three times weekly','week',current_date+4,67);
  end if;
end $$;

-- V2 development intelligence examples. This file is never run automatically in production.
do $$ declare demo_user uuid := '00000000-0000-0000-0000-000000000001'; radiology_project uuid; radiology_client uuid := gen_random_uuid(); campaign uuid := gen_random_uuid(); invoice uuid := gen_random_uuid(); begin
  if exists(select 1 from auth.users where id=demo_user) then
    select id into radiology_project from projects where user_id=demo_user and name='Radiology Center' limit 1;
    insert into clients(id,user_id,name,company,status,last_contact_at,next_follow_up_at) values(radiology_client,demo_user,'Centre de Radiologie','Centre de Radiologie','active',now()-interval '9 days',now()+interval '1 day');
    update projects set client_id=radiology_client,value_amount=12000,currency='MAD' where id=radiology_project;
    insert into invoices(id,user_id,client_id,project_id,invoice_number,title,amount,currency,subtotal,tax_amount,discount_amount,total_amount,amount_paid,amount_remaining,status,invoice_date,issue_date,due_date,notes)
      values(invoice,demo_user,radiology_client,radiology_project,'RAD-2026-014','Radiology campaign',4000,'MAD',4000,0,0,4000,0,4000,'sent',current_date-20,current_date-20,current_date-6,'Demo overdue invoice');
    insert into subscriptions(user_id,name,provider,amount,currency,billing_cycle,next_billing_date,category,status) values(demo_user,'Vercel Pro','Vercel',200,'MAD','monthly',current_date+2,'Hosting','active');
    insert into expenses(user_id,project_id,client_id,category,vendor,description,amount,currency,expense_date) values(demo_user,radiology_project,radiology_client,'Advertising','Meta','Campaign media spend',850,'MAD',current_date-3);
    insert into campaigns(id,user_id,name,client_id,project_id,objective,start_date,end_date,status,description) values(campaign,demo_user,'Radiology recruitment',radiology_client,radiology_project,'Recruit qualified technicians',current_date-12,current_date+2,'active','Demo creative campaign');
    insert into content_items(user_id,title,client_id,project_id,campaign_id,platform,format,status,priority,creative_brief,due_date,approval_status) values(demo_user,'Radiology recruitment post',radiology_client,radiology_project,campaign,'Instagram','1080x1350','designing','high','Recruitment campaign carousel',current_date+1,'pending');
    insert into prompts(user_id,title,prompt,prompt_text,description,category,favorite,usage_count) values(demo_user,'Campaign art direction','Create an editorial {format} concept for {business_name} about {campaign_topic}.','Create an editorial {format} concept for {business_name} about {campaign_topic}.','Reusable campaign visual direction','Design',true,3);
    insert into decisions(user_id,title,decision,reasoning,project_id,impact,confidence,status,decision_date,review_date) values(demo_user,'Use Supabase','Use Supabase as the application backend.','Integrated auth, PostgreSQL, storage, and RLS. ',radiology_project,'high','high','active',current_date-30,current_date+3);
    insert into fitness_activities(user_id,activity_type,activity_date,date,duration_seconds,duration_minutes,distance_meters,distance_km,source,notes) values
      (demo_user,'Running',current_date-2,current_date-2,7200,120,24200,24.2,'manual','Weekly distance demo'),
      (demo_user,'Gym',current_date-4,current_date-4,3600,60,null,null,'manual','Session 1'),
      (demo_user,'Gym',current_date-2,current_date-2,3300,55,null,null,'manual','Session 2'),
      (demo_user,'Gym',current_date-1,current_date-1,3000,50,null,null,'manual','Session 3');
    insert into fitness_targets(user_id,activity_type,target_type,target_value,period,active) values(demo_user,'Running','distance_km',30,'week',true),(demo_user,'Gym','sessions',4,'week',true),(demo_user,'Swimming','sessions',1,'week',true);
  end if;
end $$;
