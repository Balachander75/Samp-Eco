--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

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

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: create_sample_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.create_sample_requests (
    id integer NOT NULL,
    sr_number character varying(50) NOT NULL,
    year character varying(50) NOT NULL,
    product_description text NOT NULL,
    customer character varying(150) NOT NULL,
    target_plant character varying(100) DEFAULT '1505- Khaniwade'::character varying NOT NULL,
    date_request_created character varying(50) NOT NULL,
    created_by character varying(100) NOT NULL,
    created_by_user_id integer,
    material_code character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    program_year character varying(50),
    program_name character varying(150),
    source_sample_code character varying(100),
    creation_mode character varying(30) DEFAULT 'material_code'::character varying NOT NULL,
    barcode character varying(100),
    sample_required_date date,
    product_type character varying(100),
    customer_product_code character varying(100),
    brand_name character varying(150),
    product_type_navneet character varying(150),
    product_type_new_customer character varying(150),
    unit_pc_pack character varying(50),
    qty_for_sampling character varying(50),
    qty_design_costing character varying(50),
    mockup_required character varying(50),
    designs_customer_creative character varying(100),
    product_artwork_nos character varying(100),
    product_image_path text,
    target_artwork_date_creative character varying(50),
    target_artwork_date_studio character varying(50),
    request_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    folder_path text,
    submitted_designs_count integer DEFAULT 0,
    submitted_designs jsonb DEFAULT '[]'::jsonb NOT NULL,
    marketing_decision character varying(50),
    marketing_decision_remarks text,
    selected_mockup_designs jsonb DEFAULT '[]'::jsonb NOT NULL,
    mockup_requested boolean DEFAULT false NOT NULL
);


--
-- Name: create_sample_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.create_sample_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: create_sample_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.create_sample_requests_id_seq OWNED BY public.create_sample_requests.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    country character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: design_request_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_request_activity_logs (
    id integer NOT NULL,
    design_request_id integer NOT NULL,
    actor_id integer,
    actor_name character varying(255) NOT NULL,
    actor_department character varying(100) NOT NULL,
    action character varying(64) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_request_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.design_request_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: design_request_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.design_request_activity_logs_id_seq OWNED BY public.design_request_activity_logs.id;


--
-- Name: design_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_requests (
    id integer NOT NULL,
    request_code character varying(50) NOT NULL,
    sr_number character varying(50),
    customer_name character varying(150) NOT NULL,
    program_name character varying(150),
    program_year character varying(50),
    status character varying(50) NOT NULL,
    number_of_designs integer NOT NULL,
    trend character varying(200),
    target_audience character varying(200),
    reference_image text,
    product_description text NOT NULL,
    design_required_date character varying(50),
    created_by character varying(100) NOT NULL,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_path text,
    submitted_designs_count integer DEFAULT 0,
    submitted_designs jsonb DEFAULT '[]'::jsonb NOT NULL,
    marketing_decision character varying(50),
    marketing_decision_remarks text,
    selected_mockup_designs jsonb DEFAULT '[]'::jsonb NOT NULL,
    mockup_requested boolean DEFAULT false NOT NULL,
    design_remarks text,
    reference_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    reference_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    creative_submissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    remaining_design_count integer DEFAULT 0 NOT NULL
);


--
-- Name: design_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.design_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: design_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.design_requests_id_seq OWNED BY public.design_requests.id;


--
-- Name: feasibility_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feasibility_activity_logs (
    id integer NOT NULL,
    feasibility_request_id integer,
    request_code character varying(32),
    actor_id integer,
    actor_name character varying(255) NOT NULL,
    actor_department character varying(100) NOT NULL,
    action character varying(64) NOT NULL,
    payload json DEFAULT '{}'::json NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feasibility_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feasibility_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feasibility_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feasibility_activity_logs_id_seq OWNED BY public.feasibility_activity_logs.id;


--
-- Name: feasibility_reference_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feasibility_reference_images (
    id integer NOT NULL,
    feasibility_request_id integer NOT NULL,
    original_name character varying(255) NOT NULL,
    content_type character varying(64) NOT NULL,
    image_data bytea NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feasibility_reference_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feasibility_reference_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feasibility_reference_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feasibility_reference_images_id_seq OWNED BY public.feasibility_reference_images.id;


--
-- Name: feasibility_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feasibility_requests (
    id integer NOT NULL,
    request_code character varying(32) NOT NULL,
    sr_number character varying(32) NOT NULL,
    customer_id integer NOT NULL,
    feasibility_type character varying(64) NOT NULL,
    custom_feasibility_type character varying(255),
    description_notes text NOT NULL,
    required_date date NOT NULL,
    marketing_remarks text,
    reference_images json DEFAULT '[]'::json NOT NULL,
    reference_links json DEFAULT '[]'::json NOT NULL,
    status character varying(64) DEFAULT 'Pending Feasibility'::character varying NOT NULL,
    created_by character varying(255),
    request_raised_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sampling_feasibility_response character varying(32),
    sampling_feasibility_remark text,
    feasibility_closed_at timestamp with time zone,
    feasibility_closed_by character varying(32),
    request_created_by character varying(255),
    sampling_feasibility_approved_by character varying(255),
    created_by_user_id integer,
    is_responded_on_time boolean,
    marketing_decision character varying(32),
    marketing_decision_by character varying(255),
    marketing_decision_at timestamp with time zone,
    marketing_decision_remark text,
    converted_sample_request_id integer,
    converted_sr_number character varying(50),
    converted_at timestamp with time zone,
    converted_by character varying(255),
    taken_by_samp character varying(255),
    taken_at_samp timestamp with time zone
);


--
-- Name: feasibility_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feasibility_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feasibility_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feasibility_requests_id_seq OWNED BY public.feasibility_requests.id;


--
-- Name: login_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_audit_logs (
    id integer NOT NULL,
    user_id integer,
    identifier character varying(255) NOT NULL,
    ip_address character varying(100),
    user_agent character varying(500),
    status character varying(50) NOT NULL,
    failure_reason character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_audit_logs_id_seq OWNED BY public.login_audit_logs.id;


--
-- Name: plants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plants (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plants_id_seq OWNED BY public.plants.id;


--
-- Name: product_characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_characteristics (
    id integer NOT NULL,
    class_name character varying(100) NOT NULL,
    characteristic_name character varying(150) NOT NULL,
    sequence integer NOT NULL,
    uom character varying(50),
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: product_characteristics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_characteristics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_characteristics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_characteristics_id_seq OWNED BY public.product_characteristics.id;


--
-- Name: product_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_details (
    id integer NOT NULL,
    sample_request_id integer NOT NULL,
    class_name character varying(100) NOT NULL,
    characteristic_name character varying(150) NOT NULL,
    value text,
    uom character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_details_id_seq OWNED BY public.product_details.id;


--
-- Name: program_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_activity_logs (
    id integer NOT NULL,
    program_request_id integer NOT NULL,
    actor_id integer,
    actor_name character varying(255) NOT NULL,
    actor_department character varying(100) NOT NULL,
    action character varying(64) NOT NULL,
    payload json DEFAULT '{}'::json NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.program_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: program_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.program_activity_logs_id_seq OWNED BY public.program_activity_logs.id;


--
-- Name: program_material_specifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_material_specifications (
    id integer NOT NULL,
    program_request_id integer NOT NULL,
    material_type character varying(255),
    supplier_name character varying(255),
    grade character varying(255),
    color_variant character varying(255),
    caliper_wt character varying(255),
    quantity character varying(100),
    unit character varying(50) DEFAULT 'pcs'::character varying,
    remark text,
    samp_remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by character varying(255)
);


--
-- Name: program_material_specifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.program_material_specifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: program_material_specifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.program_material_specifications_id_seq OWNED BY public.program_material_specifications.id;


--
-- Name: program_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_requests (
    id integer NOT NULL,
    request_code character varying(32) NOT NULL,
    sr_number character varying(32) NOT NULL,
    customer_name character varying(255) NOT NULL,
    target_plant character varying(255) NOT NULL,
    program_campaign_title character varying(255) NOT NULL,
    program_year character varying(50) DEFAULT '2026-2027'::character varying NOT NULL,
    status character varying(64) DEFAULT 'Pending SAMP Review'::character varying NOT NULL,
    created_by character varying(255),
    created_by_user_id integer,
    sampling_seen_at timestamp with time zone,
    sampling_seen_by character varying(255),
    sampling_verdict character varying(64),
    sampling_remark text,
    sampling_signed_at timestamp with time zone,
    sampling_signed_by character varying(255),
    sampling_claimed_by_user_id integer,
    sampling_claimed_by character varying(255),
    plant_seen_at timestamp with time zone,
    plant_seen_by character varying(255),
    plant_verdict character varying(64),
    plant_remark text,
    plant_signed_at timestamp with time zone,
    plant_signed_by character varying(255),
    plant_claimed_by_user_id integer,
    plant_claimed_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.program_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: program_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.program_requests_id_seq OWNED BY public.program_requests.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_revoked boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: sample_request_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_request_types (
    id integer NOT NULL,
    sample_request_id integer NOT NULL,
    design boolean DEFAULT false NOT NULL,
    mockup boolean DEFAULT false NOT NULL,
    sample boolean DEFAULT false NOT NULL,
    costing boolean DEFAULT false NOT NULL,
    design_selected_at timestamp with time zone,
    mockup_selected_at timestamp with time zone,
    sample_selected_at timestamp with time zone,
    costing_selected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sample_request_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sample_request_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sample_request_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sample_request_types_id_seq OWNED BY public.sample_request_types.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    userid character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    sub_role character varying(100),
    team character varying(100),
    is_team_head boolean DEFAULT false NOT NULL,
    plant_code character varying(50),
    theme_id character varying(20) DEFAULT 'emerald'::character varying NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: create_sample_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.create_sample_requests ALTER COLUMN id SET DEFAULT nextval('public.create_sample_requests_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: design_request_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_request_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.design_request_activity_logs_id_seq'::regclass);


--
-- Name: design_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests ALTER COLUMN id SET DEFAULT nextval('public.design_requests_id_seq'::regclass);


--
-- Name: feasibility_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.feasibility_activity_logs_id_seq'::regclass);


--
-- Name: feasibility_reference_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_reference_images ALTER COLUMN id SET DEFAULT nextval('public.feasibility_reference_images_id_seq'::regclass);


--
-- Name: feasibility_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_requests ALTER COLUMN id SET DEFAULT nextval('public.feasibility_requests_id_seq'::regclass);


--
-- Name: login_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.login_audit_logs_id_seq'::regclass);


--
-- Name: plants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants ALTER COLUMN id SET DEFAULT nextval('public.plants_id_seq'::regclass);


--
-- Name: product_characteristics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics ALTER COLUMN id SET DEFAULT nextval('public.product_characteristics_id_seq'::regclass);


--
-- Name: product_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_details ALTER COLUMN id SET DEFAULT nextval('public.product_details_id_seq'::regclass);


--
-- Name: program_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.program_activity_logs_id_seq'::regclass);


--
-- Name: program_material_specifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_material_specifications ALTER COLUMN id SET DEFAULT nextval('public.program_material_specifications_id_seq'::regclass);


--
-- Name: program_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_requests ALTER COLUMN id SET DEFAULT nextval('public.program_requests_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: sample_request_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_types ALTER COLUMN id SET DEFAULT nextval('public.sample_request_types_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: create_sample_requests create_sample_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.create_sample_requests
    ADD CONSTRAINT create_sample_requests_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: design_request_activity_logs design_request_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_request_activity_logs
    ADD CONSTRAINT design_request_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: design_requests design_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests
    ADD CONSTRAINT design_requests_pkey PRIMARY KEY (id);


--
-- Name: feasibility_activity_logs feasibility_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_activity_logs
    ADD CONSTRAINT feasibility_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: feasibility_reference_images feasibility_reference_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_reference_images
    ADD CONSTRAINT feasibility_reference_images_pkey PRIMARY KEY (id);


--
-- Name: feasibility_requests feasibility_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_requests
    ADD CONSTRAINT feasibility_requests_pkey PRIMARY KEY (id);


--
-- Name: login_audit_logs login_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_audit_logs
    ADD CONSTRAINT login_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- Name: product_characteristics product_characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_characteristics
    ADD CONSTRAINT product_characteristics_pkey PRIMARY KEY (id);


--
-- Name: product_details product_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_details
    ADD CONSTRAINT product_details_pkey PRIMARY KEY (id);


--
-- Name: program_activity_logs program_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_activity_logs
    ADD CONSTRAINT program_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: program_material_specifications program_material_specifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_material_specifications
    ADD CONSTRAINT program_material_specifications_pkey PRIMARY KEY (id);


--
-- Name: program_requests program_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_requests
    ADD CONSTRAINT program_requests_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: sample_request_types sample_request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_types
    ADD CONSTRAINT sample_request_types_pkey PRIMARY KEY (id);


--
-- Name: sample_request_types sample_request_types_sample_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_types
    ADD CONSTRAINT sample_request_types_sample_request_id_key UNIQUE (sample_request_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT ck_users_team_head_requires_team CHECK ((NOT is_team_head) OR (NULLIF(btrim(team::text), ''::text) IS NOT NULL));


--
-- Name: ix_create_sample_requests_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_create_sample_requests_customer ON public.create_sample_requests USING btree (customer);


--
-- Name: ix_create_sample_requests_material_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_create_sample_requests_material_code ON public.create_sample_requests USING btree (material_code);


--
-- Name: ix_create_sample_requests_sr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_create_sample_requests_sr_number ON public.create_sample_requests USING btree (sr_number);


--
-- Name: ix_csr_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_csr_customer ON public.create_sample_requests USING btree (customer);


--
-- Name: ix_csr_material_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_csr_material_code ON public.create_sample_requests USING btree (material_code);


--
-- Name: ix_csr_source_sample_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_csr_source_sample_code ON public.create_sample_requests USING btree (source_sample_code);


--
-- Name: ix_csr_sr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_csr_sr_number ON public.create_sample_requests USING btree (sr_number);


--
-- Name: ix_customers_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_id ON public.customers USING btree (id);


--
-- Name: ix_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_name ON public.customers USING btree (name);


--
-- Name: ix_design_request_activity_logs_design_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_design_request_activity_logs_design_request_id ON public.design_request_activity_logs USING btree (design_request_id);


--
-- Name: ix_design_request_activity_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_design_request_activity_logs_id ON public.design_request_activity_logs USING btree (id);


--
-- Name: ix_design_requests_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_design_requests_customer_name ON public.design_requests USING btree (customer_name);


--
-- Name: ix_design_requests_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_design_requests_id ON public.design_requests USING btree (id);


--
-- Name: ix_design_requests_request_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_design_requests_request_code ON public.design_requests USING btree (request_code);


--
-- Name: ix_design_requests_sr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_design_requests_sr_number ON public.design_requests USING btree (sr_number);


--
-- Name: ix_feasibility_reference_images_feasibility_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_feasibility_reference_images_feasibility_request_id ON public.feasibility_reference_images USING btree (feasibility_request_id);


--
-- Name: ix_feasibility_reference_images_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_feasibility_reference_images_id ON public.feasibility_reference_images USING btree (id);


--
-- Name: ix_feasibility_requests_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_feasibility_requests_customer_id ON public.feasibility_requests USING btree (customer_id);


--
-- Name: ix_feasibility_requests_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_feasibility_requests_id ON public.feasibility_requests USING btree (id);


--
-- Name: ix_feasibility_requests_request_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_feasibility_requests_request_code ON public.feasibility_requests USING btree (request_code);


--
-- Name: ix_feasibility_requests_sr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_feasibility_requests_sr_number ON public.feasibility_requests USING btree (sr_number);


--
-- Name: ix_login_audit_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_login_audit_logs_id ON public.login_audit_logs USING btree (id);


--
-- Name: ix_login_audit_logs_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_login_audit_logs_identifier ON public.login_audit_logs USING btree (identifier);


--
-- Name: ix_login_audit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_login_audit_logs_status ON public.login_audit_logs USING btree (status);


--
-- Name: ix_login_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_login_audit_logs_user_id ON public.login_audit_logs USING btree (user_id);


--
-- Name: ix_pc_char_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pc_char_name ON public.product_characteristics USING btree (characteristic_name);


--
-- Name: ix_pc_class_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pc_class_name ON public.product_characteristics USING btree (class_name);


--
-- Name: ix_pd_binding_type1_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_binding_type1_lookup ON public.product_details USING btree (upper(TRIM(BOTH FROM value)), sample_request_id) WHERE ((characteristic_name)::text = 'BINDINGTYPE1'::text);


--
-- Name: ix_pd_binding_type2_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_binding_type2_lookup ON public.product_details USING btree (upper(TRIM(BOTH FROM value)), sample_request_id) WHERE ((characteristic_name)::text = 'BINDINGTYPE2'::text);


--
-- Name: ix_pd_char_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_char_name ON public.product_details USING btree (characteristic_name);


--
-- Name: ix_pd_class_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_class_name ON public.product_details USING btree (class_name);


--
-- Name: ix_pd_request_characteristic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_request_characteristic ON public.product_details USING btree (sample_request_id, characteristic_name);


--
-- Name: ix_pd_sample_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pd_sample_request_id ON public.product_details USING btree (sample_request_id);


--
-- Name: ix_plants_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_plants_code ON public.plants USING btree (code);


--
-- Name: ix_plants_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_plants_id ON public.plants USING btree (id);


--
-- Name: ix_product_characteristics_characteristic_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_characteristics_characteristic_name ON public.product_characteristics USING btree (characteristic_name);


--
-- Name: ix_product_characteristics_class_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_characteristics_class_name ON public.product_characteristics USING btree (class_name);


--
-- Name: ix_product_details_characteristic_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_details_characteristic_name ON public.product_details USING btree (characteristic_name);


--
-- Name: ix_product_details_class_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_details_class_name ON public.product_details USING btree (class_name);


--
-- Name: ix_product_details_sample_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_details_sample_request_id ON public.product_details USING btree (sample_request_id);


--
-- Name: ix_program_activity_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_activity_logs_id ON public.program_activity_logs USING btree (id);


--
-- Name: ix_program_activity_logs_program_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_activity_logs_program_request_id ON public.program_activity_logs USING btree (program_request_id);


--
-- Name: ix_program_material_specifications_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_material_specifications_id ON public.program_material_specifications USING btree (id);


--
-- Name: ix_program_material_specifications_program_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_material_specifications_program_request_id ON public.program_material_specifications USING btree (program_request_id);


--
-- Name: ix_program_requests_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_requests_customer_name ON public.program_requests USING btree (customer_name);


--
-- Name: ix_program_requests_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_program_requests_id ON public.program_requests USING btree (id);


--
-- Name: ix_program_requests_request_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_program_requests_request_code ON public.program_requests USING btree (request_code);


--
-- Name: ix_program_requests_sr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_program_requests_sr_number ON public.program_requests USING btree (sr_number);


--
-- Name: ix_refresh_tokens_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_id ON public.refresh_tokens USING btree (id);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_sample_request_types_sample_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sample_request_types_sample_request_id ON public.sample_request_types USING btree (sample_request_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_userid ON public.users USING btree (userid);


--
-- Name: ix_users_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_team ON public.users USING btree (team);


--
-- Name: ix_users_team_head; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_team_head ON public.users USING btree (team, is_team_head);


--
-- Name: uq_pc_class_char; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pc_class_char ON public.product_characteristics USING btree (class_name, characteristic_name);


--
-- Name: create_sample_requests update_create_sample_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_create_sample_requests_updated_at BEFORE UPDATE ON public.create_sample_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_characteristics update_product_characteristics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_characteristics_updated_at BEFORE UPDATE ON public.product_characteristics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_details update_product_details_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_details_updated_at BEFORE UPDATE ON public.product_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: design_request_activity_logs design_request_activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_request_activity_logs
    ADD CONSTRAINT design_request_activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: design_request_activity_logs design_request_activity_logs_design_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_request_activity_logs
    ADD CONSTRAINT design_request_activity_logs_design_request_id_fkey FOREIGN KEY (design_request_id) REFERENCES public.design_requests(id) ON DELETE CASCADE;


--
-- Name: feasibility_activity_logs feasibility_activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_activity_logs
    ADD CONSTRAINT feasibility_activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: feasibility_activity_logs feasibility_activity_logs_feasibility_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_activity_logs
    ADD CONSTRAINT feasibility_activity_logs_feasibility_request_id_fkey FOREIGN KEY (feasibility_request_id) REFERENCES public.feasibility_requests(id) ON DELETE SET NULL;


--
-- Name: feasibility_reference_images feasibility_reference_images_feasibility_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_reference_images
    ADD CONSTRAINT feasibility_reference_images_feasibility_request_id_fkey FOREIGN KEY (feasibility_request_id) REFERENCES public.feasibility_requests(id) ON DELETE CASCADE;


--
-- Name: feasibility_requests feasibility_requests_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_requests
    ADD CONSTRAINT feasibility_requests_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: feasibility_requests feasibility_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feasibility_requests
    ADD CONSTRAINT feasibility_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: product_details product_details_sample_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_details
    ADD CONSTRAINT product_details_sample_request_id_fkey FOREIGN KEY (sample_request_id) REFERENCES public.create_sample_requests(id) ON DELETE CASCADE;


--
-- Name: program_activity_logs program_activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_activity_logs
    ADD CONSTRAINT program_activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: program_activity_logs program_activity_logs_program_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_activity_logs
    ADD CONSTRAINT program_activity_logs_program_request_id_fkey FOREIGN KEY (program_request_id) REFERENCES public.program_requests(id) ON DELETE CASCADE;


--
-- Name: program_material_specifications program_material_specifications_program_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_material_specifications
    ADD CONSTRAINT program_material_specifications_program_request_id_fkey FOREIGN KEY (program_request_id) REFERENCES public.program_requests(id) ON DELETE CASCADE;


--
-- Name: sample_request_types sample_request_types_sample_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_types
    ADD CONSTRAINT sample_request_types_sample_request_id_fkey FOREIGN KEY (sample_request_id) REFERENCES public.create_sample_requests(id) ON DELETE CASCADE;


--
-- Name: sample_request_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_request_activity_logs (
    id integer NOT NULL,
    sample_request_id integer,
    request_sr_number character varying(50),
    actor_user_id integer,
    actor_name character varying(255) NOT NULL,
    actor_department character varying(100),
    action character varying(64) NOT NULL,
    from_status character varying(64),
    to_status character varying(64),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.sample_request_activity_logs_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE public.sample_request_activity_logs_id_seq
    OWNED BY public.sample_request_activity_logs.id;

ALTER TABLE ONLY public.sample_request_activity_logs
    ALTER COLUMN id SET DEFAULT nextval('public.sample_request_activity_logs_id_seq'::regclass);

ALTER TABLE ONLY public.sample_request_activity_logs
    ADD CONSTRAINT sample_request_activity_logs_pkey PRIMARY KEY (id);

CREATE INDEX ix_sample_request_activity_logs_request_sr_number
    ON public.sample_request_activity_logs USING btree (request_sr_number);
CREATE INDEX ix_sample_request_activity_logs_actor_user_id
    ON public.sample_request_activity_logs USING btree (actor_user_id);
CREATE INDEX ix_sample_request_activity_logs_created_at
    ON public.sample_request_activity_logs USING btree (created_at);
CREATE INDEX ix_sample_request_activity_request_created
    ON public.sample_request_activity_logs USING btree (sample_request_id, created_at);
CREATE INDEX ix_sample_request_activity_action_created
    ON public.sample_request_activity_logs USING btree (action, created_at);

ALTER TABLE ONLY public.sample_request_activity_logs
    ADD CONSTRAINT sample_request_activity_logs_sample_request_id_fkey
    FOREIGN KEY (sample_request_id) REFERENCES public.create_sample_requests(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sample_request_activity_logs
    ADD CONSTRAINT sample_request_activity_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.feasibility_requests
    ADD CONSTRAINT fk_feasibility_requests_converted_sample_request
    FOREIGN KEY (converted_sample_request_id) REFERENCES public.create_sample_requests(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_feasibility_requests_converted_sample_request_id
    ON public.feasibility_requests USING btree (converted_sample_request_id)
    WHERE (converted_sample_request_id IS NOT NULL);

CREATE INDEX ix_create_sample_requests_request_types_gin
    ON public.create_sample_requests USING gin (request_types jsonb_path_ops);
CREATE INDEX ix_feasibility_requests_created_by_user_id
    ON public.feasibility_requests USING btree (created_by_user_id);
CREATE INDEX ix_feasibility_activity_request_id_id
    ON public.feasibility_activity_logs USING btree (feasibility_request_id, id);
CREATE INDEX ix_feasibility_activity_request_code_created
    ON public.feasibility_activity_logs USING btree (request_code, created_at, id);

CREATE TABLE public.schema_migrations (
    version character varying(100) NOT NULL,
    description character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);


--
-- PostgreSQL database dump complete
--


