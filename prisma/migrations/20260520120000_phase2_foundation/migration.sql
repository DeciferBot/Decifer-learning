-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('child', 'parent', 'admin');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('staged', 'published', 'flagged', 'regenerating');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('sprout', 'explorer', 'lightning');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_config" JSONB,
    "theme_name" TEXT,
    "year_group_id" UUID,
    "role" "Role" NOT NULL DEFAULT 'child',
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_active" TIMESTAMP(3),
    "sr_easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "dashboard_widgets" JSONB,
    "study_buddy" TEXT,
    "accessibility_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_user_id" UUID NOT NULL,
    "child_user_id" UUID NOT NULL,

    CONSTRAINT "family_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_controls" (
    "child_profile_id" UUID NOT NULL,
    "daily_time_limit_minutes" INTEGER NOT NULL DEFAULT 60,
    "allowed_time_start" TIME,
    "allowed_time_end" TIME,
    "leaderboard_visible" BOOLEAN NOT NULL DEFAULT true,
    "social_features_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "parent_controls_pkey" PRIMARY KEY ("child_profile_id")
);

-- CreateTable
CREATE TABLE "year_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "key_stage" TEXT NOT NULL,

    CONSTRAINT "year_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "colour_token" TEXT NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_id" UUID NOT NULL,
    "year_group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "zone_id" UUID,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year_group_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "illustration_url" TEXT,
    "guardian_quiz_id" UUID,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_map_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "x_pos" DOUBLE PRECISION NOT NULL,
    "y_pos" DOUBLE PRECISION NOT NULL,
    "unlocked_by_topic_id" UUID,

    CONSTRAINT "world_map_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learn_content" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "body_html" TEXT NOT NULL,
    "examples_json" JSONB,
    "foundation_audio_url" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'staged',

    CONSTRAINT "learn_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "game_type" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,

    CONSTRAINT "practice_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "tier" "Tier" NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "distractors" JSONB NOT NULL,
    "hint_1" TEXT,
    "hint_2" TEXT,
    "hint_3" TEXT,
    "explanation" TEXT,
    "foundation_images" JSONB,
    "confidence_score" DOUBLE PRECISION,
    "status" "ContentStatus" NOT NULL DEFAULT 'staged',
    "source_chunk_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "icon_url" TEXT,
    "description" TEXT,
    "trigger_rule" JSONB NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_badges" (
    "profile_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_badges_pkey" PRIMARY KEY ("profile_id","badge_id")
);

-- CreateTable
CREATE TABLE "streak_shields" (
    "profile_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "streak_shields_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "card_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_id" UUID,
    "year_group_id" UUID,
    "rarity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fact_text" TEXT NOT NULL,
    "illustration_url" TEXT,
    "source_url" TEXT,
    "is_seasonal" BOOLEAN NOT NULL DEFAULT false,
    "available_until" TIMESTAMP(3),
    "is_fusion" BOOLEAN NOT NULL DEFAULT false,
    "required_subject_ids" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'staged',

    CONSTRAINT "card_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_collection" (
    "profile_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "first_obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_collection_pkey" PRIMARY KEY ("profile_id","card_id")
);

-- CreateTable
CREATE TABLE "topic_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "last_score" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "sr_repetitions" INTEGER NOT NULL DEFAULT 0,
    "sr_interval_days" INTEGER NOT NULL DEFAULT 1,
    "sr_next_review" DATE,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "hints_used" INTEGER NOT NULL DEFAULT 0,
    "time_taken_seconds" INTEGER NOT NULL DEFAULT 0,
    "hearts_remaining" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "child_answer" TEXT,
    "was_correct" BOOLEAN NOT NULL,
    "hint_number" INTEGER NOT NULL DEFAULT 0,
    "time_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "was_correct" BOOLEAN NOT NULL,
    "tier" "Tier" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_missions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "mission_type" TEXT NOT NULL,
    "target_topic_id" UUID,
    "target_tier" "Tier",
    "target_value" INTEGER,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "child_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "past_paper_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_board" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "paper_number" INTEGER NOT NULL,
    "question_number" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_image_url" TEXT,
    "marks_available" INTEGER NOT NULL,
    "mark_scheme" JSONB NOT NULL,
    "topic_tag" TEXT[],

    CONSTRAINT "past_paper_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject" TEXT NOT NULL,
    "year_group" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "curriculum_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "year_group_id" UUID NOT NULL,
    "question_ids" JSONB NOT NULL,
    "is_flare" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_links_parent_user_id_child_user_id_key" ON "family_links"("parent_user_id", "child_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "year_groups_label_key" ON "year_groups"("label");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE INDEX "quiz_questions_topic_id_status_tier_idx" ON "quiz_questions"("topic_id", "status", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topic_progress_profile_id_topic_id_key" ON "topic_progress"("profile_id", "topic_id");

-- CreateIndex
CREATE INDEX "session_answers_profile_id_created_at_idx" ON "session_answers"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "curriculum_chunks_subject_year_group_idx" ON "curriculum_chunks"("subject", "year_group");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenges_date_year_group_id_key" ON "daily_challenges"("date", "year_group_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_year_group_id_fkey" FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_child_user_id_fkey" FOREIGN KEY ("child_user_id") REFERENCES "profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_controls" ADD CONSTRAINT "parent_controls_child_profile_id_fkey" FOREIGN KEY ("child_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_year_group_id_fkey" FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_year_group_id_fkey" FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_map_nodes" ADD CONSTRAINT "world_map_nodes_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_map_nodes" ADD CONSTRAINT "world_map_nodes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_map_nodes" ADD CONSTRAINT "world_map_nodes_unlocked_by_topic_id_fkey" FOREIGN KEY ("unlocked_by_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learn_content" ADD CONSTRAINT "learn_content_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_games" ADD CONSTRAINT "practice_games_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_shields" ADD CONSTRAINT "streak_shields_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_catalog" ADD CONSTRAINT "card_catalog_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_collection" ADD CONSTRAINT "child_collection_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_collection" ADD CONSTRAINT "child_collection_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "card_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_answers" ADD CONSTRAINT "session_answers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_answers" ADD CONSTRAINT "session_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_missions" ADD CONSTRAINT "child_missions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_missions" ADD CONSTRAINT "child_missions_target_topic_id_fkey" FOREIGN KEY ("target_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_year_group_id_fkey" FOREIGN KEY ("year_group_id") REFERENCES "year_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

