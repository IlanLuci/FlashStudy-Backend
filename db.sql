CREATE TABLE accounts (
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  tokens TEXT,
  sets TEXT,
  notes TEXT
);

CREATE TABLE sets (
  id BIGINT NOT NULL,
  creator TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  completions INTEGER, /* number of times the set has been completed */
  case_sensitive BOOLEAN,
  accent_sensitive BOOLEAN,
  spanish BOOLEAN,
  q_name TEXT, /* title of questions list (eg: states) */
  q_items TEXT, /* questions (eg: NY) */
  a_name TEXT, /* title of answers list (eg: capitals) */
  a_items TEXT /* answers (eg: Buffalo) */
);

CREATE TABLE notes (
  id BIGINT NOT NULL,
  creator TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  note TEXT NOT NULL
);