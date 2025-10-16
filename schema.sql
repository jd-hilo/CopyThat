

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."notify_reaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only create notification if it's not a self-reaction
  IF EXISTS (
    SELECT 1 FROM stories 
    WHERE id = NEW.story_id 
    AND user_id != NEW.user_id
  ) THEN
    INSERT INTO notifications (
      header,
      message,
      is_active,
      created_at,
      created_by,
      user_id,
      type,
      story_id,
      read
    )
    SELECT 
      'New Reaction!',
      profiles.username || ' reacted to your story: "' || stories.title || '"',
      true,
      NOW(),
      NEW.user_id,
      stories.user_id,
      'audio_reaction',
      NEW.story_id,
      false
    FROM stories
    JOIN profiles ON profiles.id = NEW.user_id
    WHERE stories.id = NEW.story_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_reaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audio_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "timestamp" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audio_reactions_duration_check" CHECK (("duration" <= 30))
);


ALTER TABLE "public"."audio_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emoji_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "emoji_reactions_emoji_check" CHECK (("emoji" = ANY (ARRAY['❤️'::"text", '😂'::"text", '😮'::"text", '😢'::"text", '👏'::"text", '🎵'::"text"])))
);


ALTER TABLE "public"."emoji_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reactions_type_check" CHECK (("type" = ANY (ARRAY['heart'::"text", 'laugh'::"text", 'wow'::"text", 'sad'::"text"])))
);


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "is_public" boolean DEFAULT true,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_tags" (
    "story_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    CONSTRAINT "story_tags_tag_check" CHECK (("tag" = ANY (ARRAY['venting'::"text", 'feedback'::"text", 'storytime'::"text"])))
);


ALTER TABLE "public"."story_tags" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audio_reactions"
    ADD CONSTRAINT "audio_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audio_reactions"
    ADD CONSTRAINT "audio_reactions_story_id_user_id_timestamp_key" UNIQUE ("story_id", "user_id", "timestamp");



ALTER TABLE ONLY "public"."emoji_reactions"
    ADD CONSTRAINT "emoji_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emoji_reactions"
    ADD CONSTRAINT "emoji_reactions_story_id_user_id_emoji_key" UNIQUE ("story_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_story_id_user_id_key" UNIQUE ("story_id", "user_id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_tags"
    ADD CONSTRAINT "story_tags_pkey" PRIMARY KEY ("story_id", "tag");



CREATE OR REPLACE TRIGGER "notify_reaction_trigger" AFTER INSERT ON "public"."reactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_reaction"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stories_updated_at" BEFORE UPDATE ON "public"."stories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audio_reactions"
    ADD CONSTRAINT "audio_reactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audio_reactions"
    ADD CONSTRAINT "audio_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emoji_reactions"
    ADD CONSTRAINT "emoji_reactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emoji_reactions"
    ADD CONSTRAINT "emoji_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_tags"
    ADD CONSTRAINT "story_tags_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view audio reactions" ON "public"."audio_reactions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view emoji reactions" ON "public"."emoji_reactions" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create reactions" ON "public"."reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable profile creation during signup" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public stories are viewable by everyone" ON "public"."stories" FOR SELECT USING ((("is_public" = true) OR ("author_id" = "auth"."uid"())));



CREATE POLICY "Reactions are viewable by everyone" ON "public"."reactions" FOR SELECT USING (true);



CREATE POLICY "Story tags are viewable by everyone" ON "public"."story_tags" FOR SELECT USING (true);



CREATE POLICY "Users can add tags to own stories" ON "public"."story_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_tags"."story_id") AND ("stories"."author_id" = "auth"."uid"())))));



CREATE POLICY "Users can create audio reactions" ON "public"."audio_reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create emoji reactions" ON "public"."emoji_reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own stories" ON "public"."stories" FOR INSERT WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own reactions" ON "public"."reactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own stories" ON "public"."stories" FOR DELETE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can delete tags from own stories" ON "public"."story_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_tags"."story_id") AND ("stories"."author_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their audio reactions" ON "public"."audio_reactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their emoji reactions" ON "public"."emoji_reactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own stories" ON "public"."stories" FOR UPDATE USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."audio_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emoji_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_tags" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."audio_reactions" TO "anon";
GRANT ALL ON TABLE "public"."audio_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."audio_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."emoji_reactions" TO "anon";
GRANT ALL ON TABLE "public"."emoji_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."emoji_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reactions" TO "anon";
GRANT ALL ON TABLE "public"."reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reactions" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."story_tags" TO "anon";
GRANT ALL ON TABLE "public"."story_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."story_tags" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
