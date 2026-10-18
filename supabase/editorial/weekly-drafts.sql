-- Offline review package. No clinical review or publication is created.

-- Import only into an explicitly chosen editorial environment.

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-01') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (1, 'Week 1') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-01','A place to begin','What would I like this space to help me with?','planning','in_review' from public.pregnancy_weeks where week_number=1 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can use this space without recording every detail. Choose whether memories, care questions, or practical plans would be most useful to you.

A question for you: What would I like this space to help me with?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-02') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (2, 'Week 2') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-02','Your own pace','What do I want to keep, and what can I leave out?','planning','in_review' from public.pregnancy_weeks where week_number=2 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A blank day is not a missed task. You can keep a short note when something matters and leave the rest of the timeline empty.

A question for you: What do I want to keep, and what can I leave out?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-03') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (3, 'Week 3') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-03','Choose your words','What words fit today?','planning','in_review' from public.pregnancy_weeks where week_number=3 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Your notes do not need to sound positive or complete. A few words can hold a question, an uncertain feeling, or an ordinary moment.

A question for you: What words fit today?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-04') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (4, 'Week 4') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-04','Keep one question','What is the first thing I want to ask?','planning','in_review' from public.pregnancy_weeks where week_number=4 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can keep a question before you know how to answer it. Add it to a visit when you have an appointment recorded in Care.

A question for you: What is the first thing I want to ask?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-05') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (5, 'Week 5') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-05','Find your contact details','Which contact details would I like to have ready?','planning','in_review' from public.pregnancy_weeks where week_number=5 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Contact details are easier to use when they are together. Care has space for your providers and the people you would choose to contact.

A question for you: Which contact details would I like to have ready?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-06') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (6, 'Week 6') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-06','Prepare in your own words','What matters most at my next conversation?','planning','in_review' from public.pregnancy_weeks where week_number=6 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A visit note can start with the subject you most want to discuss. You can edit it before including it in a provider summary.

A question for you: What matters most at my next conversation?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-07') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (7, 'Week 7') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-07','Decide what to share','What would I like my support person to know?','planning','in_review' from public.pregnancy_weeks where week_number=7 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A support person does not need every private detail to be helpful. Review the items and categories you have chosen to share in Together.

A question for you: What would I like my support person to know?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-08') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (8, 'Week 8') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-08','Record a small moment','Is there a small detail I want to remember?','planning','in_review' from public.pregnancy_weeks where week_number=8 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A memory can be an ordinary detail: a place, a conversation, or a photo. You decide whether that entry may appear in a later memory collection.

A question for you: Is there a small detail I want to remember?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-09') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (9, 'Week 9') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-09','Make a little room for help','What help would be useful today?','planning','in_review' from public.pregnancy_weeks where week_number=9 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A clear request gives another person something concrete to respond to. You can ask for practical help, a listening ear, food or water, or quiet time.

A question for you: What help would be useful today?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-10') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (10, 'Week 10') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-10','Keep your visit notes together','What would I like explained again?','planning','in_review' from public.pregnancy_weeks where week_number=10 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

After a conversation, you can record what you understood and what you want to ask again. Your notes are your own record, not a replacement for the care team''s instructions.

A question for you: What would I like explained again?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-11') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (11, 'Week 11') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-11','Choose the first question','Which question should come first?','planning','in_review' from public.pregnancy_weeks where week_number=11 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

If you have several questions, choose the one you most want to ask. In Care you can mark priorities and decide which questions belong in the summary.

A question for you: Which question should come first?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-12') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (12, 'Week 12') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-12','A photo, if you want one','What would I like this photo to remind me of?','planning','in_review' from public.pregnancy_weeks where week_number=12 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can keep photos without making a public album. Check an entry''s privacy setting before saving it and choose separately whether it may appear again.

A question for you: What would I like this photo to remind me of?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-13') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (13, 'Week 13') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-13','Notice what is useful','Which part of the app can I leave aside?','planning','in_review' from public.pregnancy_weeks where week_number=13 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Your app can stay simple. Hide content that is not helpful and use the areas that match what you need now.

A question for you: Which part of the app can I leave aside?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-14') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (14, 'Week 14') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-14','Prepare for the next conversation','Which details do I want to discuss?','planning','in_review' from public.pregnancy_weeks where week_number=14 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can gather a few user-recorded observations for a visit. Review the summary before printing or sharing it so that only your chosen details leave the app.

A question for you: Which details do I want to discuss?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-15') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (15, 'Week 15') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-15','Support that fits','What kind of support fits today?','planning','in_review' from public.pregnancy_weeks where week_number=15 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Support can change from one day to another. A request for quiet time is as clear as a request for a household task.

A question for you: What kind of support fits today?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-16') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (16, 'Week 16') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-16','Write down unfamiliar words','Which word or result do I want explained?','planning','in_review' from public.pregnancy_weeks where week_number=16 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

If a word from a visit is unclear, you can keep it as a question. The app can hold the question while your care team provides the explanation.

A question for you: Which word or result do I want explained?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-17') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (17, 'Week 17') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-17','Keep one practical plan','What is one practical task I want to keep visible?','planning','in_review' from public.pregnancy_weeks where week_number=17 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can start a plan with one task. A template is only a starting point: edit its words and leave out anything that does not fit.

A question for you: What is one practical task I want to keep visible?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-18') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (18, 'Week 18') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-18','Your questions can change','What has changed since I wrote my questions?','planning','in_review' from public.pregnancy_weeks where week_number=18 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A question saved earlier may no longer be the one you want to ask. Review your list before a visit and choose which items still matter.

A question for you: What has changed since I wrote my questions?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-19') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (19, 'Week 19') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-19','Keep the ordinary details','What ordinary detail would I like to keep?','planning','in_review' from public.pregnancy_weeks where week_number=19 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Not every memory needs to mark a milestone. An ordinary meal, a familiar place, or a short conversation can belong in your private timeline.

A question for you: What ordinary detail would I like to keep?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-20') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (20, 'Week 20') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-20','Review a few memories','Which moments would I choose to revisit?','planning','in_review' from public.pregnancy_weeks where week_number=20 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A weekly collection can hold up to five eligible entries. You choose which entries may return and which ones to include. Saving a collection does not share it.

A question for you: Which moments would I choose to revisit?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-21') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (21, 'Week 21') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-21','Make the next step clear','What do I want to confirm before I act?','planning','in_review' from public.pregnancy_weeks where week_number=21 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

After an appointment you can write down one next action in your own words. Ask the care team to clarify instructions rather than relying on the app to interpret them.

A question for you: What do I want to confirm before I act?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-22') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (22, 'Week 22') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-22','Talk about your preferences','What would I like to understand about my choices?','planning','in_review' from public.pregnancy_weeks where week_number=22 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Your preferences can be a conversation with your care team. Use a planning list to collect questions about the choices available to you.

A question for you: What would I like to understand about my choices?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-23') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (23, 'Week 23') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-23','A role for your support person','What would help my support person understand their role?','planning','in_review' from public.pregnancy_weeks where week_number=23 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can describe the practical help you want from a support person. Together lets you choose shared tasks without sharing your full journal.

A question for you: What would help my support person understand their role?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-24') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (24, 'Week 24') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-24','Prepare a short summary','What belongs in my next visit summary?','planning','in_review' from public.pregnancy_weeks where week_number=24 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A short summary can help you organise a visit. Choose the questions and user-recorded details you want included, then review the result before sharing it.

A question for you: What belongs in my next visit summary?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-25') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (25, 'Week 25') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-25','Plans can be edited','Which task should I change or leave out?','planning','in_review' from public.pregnancy_weeks where week_number=25 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can change a task as your plans change. Removing it from your plan keeps it available to restore if you want it later.

A question for you: Which task should I change or leave out?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-26') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (26, 'Week 26') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-26','Think about help at home','Which home task would I most like help with?','planning','in_review' from public.pregnancy_weeks where week_number=26 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Practical support can include meals, shopping, household tasks, or transport. You can make a private list first and review sharing before asking someone to help.

A question for you: Which home task would I most like help with?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-27') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (27, 'Week 27') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-27','Keep contact choices clear','Is there a contact detail I still need?','planning','in_review' from public.pregnancy_weeks where week_number=27 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Knowing whom you want to contact can reduce searching later. Review the details you saved in Care and ask your care team how to reach them between visits.

A question for you: Is there a contact detail I still need?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-28') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (28, 'Week 28') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-28','Discuss changes to a plan','How would I like changes explained to me?','planning','in_review' from public.pregnancy_weeks where week_number=28 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Preferences may need to change. You can ask your care team how they will explain changes and how you can take part in decisions.

A question for you: How would I like changes explained to me?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-29') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (29, 'Week 29') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-29','Start a packing draft','What do I need to check with my hospital?','planning','in_review' from public.pregnancy_weeks where week_number=29 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

If a hospital stay is part of your plans, its own packing information is a useful reference. Your Flutterings list can hold the items you choose to bring.

A question for you: What do I need to check with my hospital?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Hospital bag checklist','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-30') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (30, 'Week 30') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-30','Keep your list personal','Which items are useful for me?','planning','in_review' from public.pregnancy_weeks where week_number=30 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A template does not need to become a shopping list. Keep the items that fit your plans, change the wording, and exclude the rest.

A question for you: Which items are useful for me?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Hospital bag checklist','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-31') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (31, 'Week 31') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-31','Plan practical journeys','What journey or arrangement would I like to discuss?','planning','in_review' from public.pregnancy_weeks where week_number=31 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Transport can be a task in your plan. You can record who you want to ask and the details you want to confirm, without sharing unrelated care notes.

A question for you: What journey or arrangement would I like to discuss?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-32') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (32, 'Week 32') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-32','Review your preferences','Which preference needs a conversation?','planning','in_review' from public.pregnancy_weeks where week_number=32 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can revisit your birth-preference questions and take them to your care team. Flutterings records your words; it does not decide which options are suitable for you.

A question for you: Which preference needs a conversation?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-33') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (33, 'Week 33') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-33','Prepare for support after birth','What would make help easier to ask for?','planning','in_review' from public.pregnancy_weeks where week_number=33 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can make a practical support list before you need it. Meals, household tasks, transport, and visitor preferences can be edited later.

A question for you: What would make help easier to ask for?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-34') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (34, 'Week 34') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-34','Keep important items together','Which instructions do I need to confirm?','planning','in_review' from public.pregnancy_weeks where week_number=34 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

A packing list can include the documents and contact details your care team asks you to bring. Check local instructions before treating a general list as complete.

A question for you: Which instructions do I need to confirm?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Hospital bag checklist','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-35') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (35, 'Week 35') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-35','Choose your communication preferences','What helps me understand information?','planning','in_review' from public.pregnancy_weeks where week_number=35 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can write down how you want explanations and questions handled. Your support person can help with the parts you choose to share.

A question for you: What helps me understand information?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-36') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (36, 'Week 36') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-36','Check practical arrangements','What remains useful on my list?','planning','in_review' from public.pregnancy_weeks where week_number=36 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Review your chosen tasks and remove anything that no longer fits. You can keep a small list instead of treating every suggestion as a requirement.

A question for you: What remains useful on my list?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Hospital bag checklist','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/hospital-bag-checklist/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-37') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (37, 'Week 37') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-37','Make space for quiet','What boundary would I like help expressing?','planning','in_review' from public.pregnancy_weeks where week_number=37 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can ask for fewer visits, fewer messages, or practical help. Write the request in the way that works for you and choose who receives it.

A question for you: What boundary would I like help expressing?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-38') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (38, 'Week 38') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-38','Keep your questions available','What would I like to ask at my next contact?','planning','in_review' from public.pregnancy_weeks where week_number=38 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Your saved questions can stay available even when plans change. Choose the questions you want to raise and keep your care team''s contact information accessible.

A question for you: What would I like to ask at my next contact?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-39') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (39, 'Week 39') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-39','Review what you want to share','Do my sharing choices still fit?','planning','in_review' from public.pregnancy_weeks where week_number=39 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can review a support person''s current access in Together. Sharing a task and sharing a journal entry are separate choices.

A question for you: Do my sharing choices still fit?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('What to include in your birth plan','NHS','https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/best-start-in-life/pregnancy/preparing-for-labour-and-birth/what-to-include-in-your-birth-plan/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-40') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (40, 'Week 40') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-40','Your plans, today','What would be useful to discuss now?','planning','in_review' from public.pregnancy_weeks where week_number=40 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

An estimated date does not have to become a task deadline in your journal. You can keep a note or question and follow the arrangements you make with your care team.

A question for you: What would be useful to discuss now?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-41') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (41, 'Week 41') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-41','Keep one next question','What do I want clarified about my plan?','planning','in_review' from public.pregnancy_weeks where week_number=41 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

You can record the next question you want to discuss without adding more tracking. Your care team can explain your individual plan; Flutterings keeps your selected notes together.

A question for you: What do I want clarified about my plan?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;

do $draft$
declare v_article uuid; v_version uuid; v_source uuid;
begin
  -- Never overwrite an existing editorial revision, review, or publication.
  if exists (select 1 from public.content_articles where slug = 'flutterings-week-42') then return; end if;
  insert into public.pregnancy_weeks(week_number,title) values (42, 'Week 42') on conflict (week_number) do nothing;
  insert into public.content_articles(pregnancy_week_id,slug,title,summary,content_kind,status)
    select id,'flutterings-week-42','Your records stay with you','How would I like this space to support me next?','planning','in_review' from public.pregnancy_weeks where week_number=42 returning id into v_article;
  insert into public.content_versions(article_id,version_number,body_markdown,change_summary,submitted_for_review_at)
    values(v_article,1,'NOT CLINICALLY APPROVED

Your memories and notes remain available when you change pregnancy settings. Support after birth is optional, and settings let you hide pregnancy progression when it is not useful.

A question for you: How would I like this space to support me next?','Original planning copy; needs clinical, jurisdiction, and sensitive-language review.',now()) returning id into v_version;
  update public.content_articles set current_version_id=v_version where id=v_article;
  insert into public.content_sources(title,publisher,source_url,accessed_at,jurisdiction_code)
    values('Antenatal care and appointments','NHS','https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/','2026-10-16T00:00:00Z','GB') on conflict (source_url) do nothing;
  select id into v_source from public.content_sources where source_url='https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/';
  insert into public.content_version_sources(content_version_id,content_source_id,citation_note)
    values(v_version,v_source,'Background reference for reviewer; not a source for Flutterings feature claims or a universal care schedule.');
end;
$draft$;
