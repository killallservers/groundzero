CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text DEFAULT 'extract' NOT NULL,
	`idea` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
