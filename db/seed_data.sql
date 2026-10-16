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
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers VALUES (1, 'Avalon International Ltd.', 'New Zealand', '2026-10-14 21:56:22.012735+05:30', '2026-09-07 13:50:31.955424+05:30');
INSERT INTO public.customers VALUES (2, 'Ustro Ulrich Strobel Gmbh', 'Germany', '2026-10-14 21:56:22.012735+05:30', '2026-09-07 13:50:31.955426+05:30');
INSERT INTO public.customers VALUES (3, 'Freedom Stationery (Pty) Ltd.', 'South Africa', '2026-10-14 21:56:22.012735+05:30', '2026-09-07 13:50:31.955427+05:30');
INSERT INTO public.customers VALUES (4, 'Nemo Traders S.A.', 'Panama', '2026-10-14 21:56:22.012735+05:30', '2026-09-07 13:50:31.955427+05:30');
INSERT INTO public.customers VALUES (5, 'Svojtka & Co, s.r.o', 'Czech Republic', '2026-10-14 21:56:22.012735+05:30', '2026-09-07 13:50:31.955428+05:30');
INSERT INTO public.customers VALUES (6, 'Sai Office Supplies Limited.', 'Kenya', '2026-10-14 23:16:16.080402+05:30', '2026-09-07 13:50:31.955429+05:30');
INSERT INTO public.customers VALUES (7, 'Tedi GmbH & Co. KG', 'Germany', '2026-10-14 23:17:52.873731+05:30', '2026-09-07 13:50:31.955429+05:30');
INSERT INTO public.customers VALUES (8, 'Daily Latino America S.A.', 'Panama', '2026-09-07 13:50:31.95543+05:30', '2026-09-07 13:50:31.95543+05:30');
INSERT INTO public.customers VALUES (9, 'John Dickinson & Co. (West Indies) Ltd.', 'Trinidad,Tobago', '2026-09-07 13:50:31.955431+05:30', '2026-09-07 13:50:31.955431+05:30');
INSERT INTO public.customers VALUES (10, 'HRK Group, Inc.', 'USA', '2026-09-07 13:50:31.955431+05:30', '2026-09-07 13:50:31.955431+05:30');
INSERT INTO public.customers VALUES (11, 'C.M.R. & Company Ltd', 'Trinidad,Tobago', '2026-09-07 13:50:31.955432+05:30', '2026-09-07 13:50:31.955432+05:30');
INSERT INTO public.customers VALUES (12, 'Printech Ltd', 'Zambia', '2026-09-07 13:50:31.955433+05:30', '2026-09-07 13:50:31.955433+05:30');
INSERT INTO public.customers VALUES (13, 'Target Global Sourcing Limited', 'Hong Kong', '2026-09-07 13:50:31.955433+05:30', '2026-09-07 13:50:31.955434+05:30');
INSERT INTO public.customers VALUES (14, 'King''s Stationers', 'Tanzania', '2026-09-07 13:50:31.955434+05:30', '2026-09-07 13:50:31.955434+05:30');
INSERT INTO public.customers VALUES (15, 'Manpalider S.A', 'Costa Rica', '2026-09-07 13:50:31.955435+05:30', '2026-09-07 13:50:31.955435+05:30');
INSERT INTO public.customers VALUES (16, 'JYOSUN NV', 'St. Martin', '2026-09-07 13:50:31.955435+05:30', '2026-09-07 13:50:31.955436+05:30');
INSERT INTO public.customers VALUES (17, 'Comercializadora Mexico', 'Mexico', '2026-09-07 13:50:31.955436+05:30', '2026-09-07 13:50:31.955436+05:30');
INSERT INTO public.customers VALUES (18, 'Staples,The Office Superstore, LLC', 'USA', '2026-09-07 13:50:31.955436+05:30', '2026-09-07 13:50:31.955437+05:30');
INSERT INTO public.customers VALUES (19, 'Dollar General Corporation', 'USA', '2026-09-07 13:50:31.955437+05:30', '2026-09-07 13:50:31.955437+05:30');
INSERT INTO public.customers VALUES (20, 'Dolgencorp, LLC', 'USA', '2026-09-07 13:50:31.955438+05:30', '2026-09-07 13:50:31.955438+05:30');
INSERT INTO public.customers VALUES (21, 'Techno A Class SARL', 'Togo', '2026-09-07 13:50:31.955438+05:30', '2026-09-07 13:50:31.955439+05:30');
INSERT INTO public.customers VALUES (22, 'Ste Technomart Sarl', 'Ivory Coast', '2026-09-07 13:50:31.955439+05:30', '2026-09-07 13:50:31.955439+05:30');
INSERT INTO public.customers VALUES (23, 'Woolworth Gmbh', 'Germany', '2026-09-07 13:50:31.95544+05:30', '2026-09-07 13:50:31.95544+05:30');
INSERT INTO public.customers VALUES (24, 'Norwegian Toy Import A/S', 'Norway', '2026-09-07 13:50:31.95544+05:30', '2026-09-07 13:50:31.95544+05:30');
INSERT INTO public.customers VALUES (25, 'Walmart, Inc', 'USA', '2026-09-07 13:50:31.955441+05:30', '2026-09-07 13:50:31.955441+05:30');
INSERT INTO public.customers VALUES (26, 'Greenbrier International, INC', 'USA', '2026-09-07 13:50:31.955441+05:30', '2026-09-07 13:50:31.955442+05:30');
INSERT INTO public.customers VALUES (27, 'Dollar Tree Stores Canada, INC', 'Canada', '2026-09-07 13:50:31.955442+05:30', '2026-09-07 13:50:31.955442+05:30');
INSERT INTO public.customers VALUES (28, 'Walmart canada Corp', 'Canada', '2026-09-07 13:50:31.955443+05:30', '2026-09-07 13:50:31.955443+05:30');
INSERT INTO public.customers VALUES (29, 'Sai Office Supplies (UG) LTD', 'Uganda', '2026-09-07 13:50:31.955443+05:30', '2026-09-07 13:50:31.955444+05:30');
INSERT INTO public.customers VALUES (30, 'KIK Textilien und non-Food GmbH', 'Germany', '2026-09-07 13:50:31.955444+05:30', '2026-09-07 13:50:31.955444+05:30');
INSERT INTO public.customers VALUES (31, 'Asda Stores Ltd', 'United Kingdom', '2026-09-07 13:50:31.955445+05:30', '2026-09-07 13:50:31.955445+05:30');
INSERT INTO public.customers VALUES (32, 'Family Dollar Services, LLC.', 'USA', '2026-09-07 13:50:31.955445+05:30', '2026-09-07 13:50:31.955446+05:30');
INSERT INTO public.customers VALUES (33, 'Full Solutions S.A. De C.V', 'El Salvador', '2026-09-07 13:50:31.955446+05:30', '2026-09-07 13:50:31.955446+05:30');
INSERT INTO public.customers VALUES (34, 'L. G. Sales Ltd', 'St. Vincent', '2026-09-07 13:50:31.955446+05:30', '2026-09-07 13:50:31.955447+05:30');
INSERT INTO public.customers VALUES (35, 'Prima Toy & Leisure Trading(Pty) Lt', 'South Africa', '2026-09-07 13:50:31.955447+05:30', '2026-09-07 13:50:31.955447+05:30');
INSERT INTO public.customers VALUES (36, 'Yeayoo (U.K.) Limited', 'China', '2026-09-07 13:50:31.955448+05:30', '2026-09-07 13:50:31.955448+05:30');
INSERT INTO public.customers VALUES (37, 'Heneck Sacks A Div Of Melbro', 'South Africa', '2026-09-07 13:50:31.955448+05:30', '2026-09-07 13:50:31.955449+05:30');
INSERT INTO public.customers VALUES (38, 'Rushabh Stationers', 'Kenya', '2026-09-07 13:50:31.955449+05:30', '2026-09-07 13:50:31.955449+05:30');
INSERT INTO public.customers VALUES (39, 'Caribbean Retail Ventures, Inc.', 'Puerto Rico', '2026-09-07 13:50:31.955449+05:30', '2026-09-07 13:50:31.95545+05:30');
INSERT INTO public.customers VALUES (40, 'PNS Trading LLC', 'UAE', '2026-09-07 13:50:31.95545+05:30', '2026-09-07 13:50:31.95545+05:30');
INSERT INTO public.customers VALUES (41, 'Golden Arch Fzc', 'UAE', '2026-09-07 13:50:31.955451+05:30', '2026-09-07 13:50:31.955451+05:30');
INSERT INTO public.customers VALUES (42, 'Wm Morrison Supermarkets PLC.', 'United Kingdom', '2026-09-07 13:50:31.955451+05:30', '2026-09-07 13:50:31.955452+05:30');
INSERT INTO public.customers VALUES (43, 'Wm Morrison (HK) Ltd', 'Hong Kong', '2026-09-07 13:50:31.955452+05:30', '2026-09-07 13:50:31.955452+05:30');
INSERT INTO public.customers VALUES (44, 'OFIMAYOR.COM, S.A,', 'Panama', '2026-09-07 13:50:31.955453+05:30', '2026-09-07 13:50:31.955453+05:30');
INSERT INTO public.customers VALUES (45, 'Indo Global Sourcing Limited', 'Hong Kong', '2026-09-07 13:50:31.955453+05:30', '2026-09-07 13:50:31.955453+05:30');
INSERT INTO public.customers VALUES (46, 'Kingston Bookshop Ltd.', 'Jamaica', '2026-09-07 13:50:31.955454+05:30', '2026-09-07 13:50:31.955454+05:30');
INSERT INTO public.customers VALUES (47, 'Oki General Trading Llc', 'UAE', '2026-09-07 13:50:31.955454+05:30', '2026-09-07 13:50:31.955455+05:30');
INSERT INTO public.customers VALUES (48, 'Birgma International SA', 'Sweden', '2026-09-07 13:50:31.955455+05:30', '2026-09-07 13:50:31.955455+05:30');
INSERT INTO public.customers VALUES (49, 'SBIN B.V', 'Netherlands', '2026-09-07 13:50:31.955456+05:30', '2026-09-07 13:50:31.955456+05:30');
INSERT INTO public.customers VALUES (50, 'Birgma Asia Trading Limited', 'Hong Kong', '2026-09-07 13:50:31.955456+05:30', '2026-09-07 13:50:31.955456+05:30');
INSERT INTO public.customers VALUES (51, 'STIC Corp.', 'USA', '2026-09-07 13:50:31.955457+05:30', '2026-09-07 13:50:31.955457+05:30');
INSERT INTO public.customers VALUES (52, 'Techno Plus', 'Burkina-Faso', '2026-09-07 13:50:31.955457+05:30', '2026-09-07 13:50:31.955458+05:30');
INSERT INTO public.customers VALUES (53, 'Waitrose', 'United Kingdom', '2026-09-07 13:50:31.955458+05:30', '2026-09-07 13:50:31.955458+05:30');
INSERT INTO public.customers VALUES (54, 'Al Fahidi Stationery Centre', 'UAE', '2026-09-07 13:50:31.955459+05:30', '2026-09-07 13:50:31.955459+05:30');
INSERT INTO public.customers VALUES (55, 'Sc Editura Crisan Srl', 'Romania', '2026-09-07 13:50:31.955459+05:30', '2026-09-07 13:50:31.95546+05:30');
INSERT INTO public.customers VALUES (56, 'American Paper Corporation', 'Puerto Rico', '2026-09-07 13:50:31.95546+05:30', '2026-09-07 13:50:31.95546+05:30');
INSERT INTO public.customers VALUES (57, 'Gonzalez Pereira ,Sociedad Anonima', 'Nicaragua', '2026-09-07 13:50:31.955461+05:30', '2026-09-07 13:50:31.955461+05:30');
INSERT INTO public.customers VALUES (58, 'Full Products Centroamerica, S.A. De C.V', 'Honduras', '2026-09-07 13:50:31.955461+05:30', '2026-09-07 13:50:31.955462+05:30');
INSERT INTO public.customers VALUES (59, 'Full Products Centroamerica S.A', 'Guatemala', '2026-09-07 13:50:31.955462+05:30', '2026-09-07 13:50:31.955462+05:30');
INSERT INTO public.customers VALUES (60, 'Libreria  Lendoiro SAS', 'Dominican Rep.', '2026-09-07 13:50:31.955463+05:30', '2026-09-07 13:50:31.955463+05:30');
INSERT INTO public.customers VALUES (61, '1616 Holdings, Inc.', 'USA', '2026-09-07 13:50:31.955463+05:30', '2026-09-07 13:50:31.955464+05:30');
INSERT INTO public.customers VALUES (62, 'WS Trading Limited', 'Hong Kong', '2026-09-07 13:50:31.955464+05:30', '2026-09-07 13:50:31.955464+05:30');
INSERT INTO public.customers VALUES (63, 'Al Hathboor International LLC', 'UAE', '2026-09-07 13:50:31.955465+05:30', '2026-09-07 13:50:31.955465+05:30');
INSERT INTO public.customers VALUES (64, 'Bangkit Usa Inc', 'USA', '2026-09-07 13:50:31.955465+05:30', '2026-09-07 13:50:31.955466+05:30');
INSERT INTO public.customers VALUES (65, 'Staples Canada ULC', 'Canada', '2026-09-07 13:50:31.955466+05:30', '2026-09-07 13:50:31.955466+05:30');
INSERT INTO public.customers VALUES (66, 'Walmart Inc (Sam''S Club)', 'USA', '2026-09-07 13:50:31.955466+05:30', '2026-09-07 13:50:31.955467+05:30');
INSERT INTO public.customers VALUES (67, 'Ollie''S Bargain Outlet, Inc', 'USA', '2026-09-07 13:50:31.955467+05:30', '2026-09-07 13:50:31.955467+05:30');
INSERT INTO public.customers VALUES (68, 'Aromix Panama S.A', 'Panama', '2026-09-07 13:50:31.955468+05:30', '2026-09-07 13:50:31.955468+05:30');
INSERT INTO public.customers VALUES (69, 'El Machetazo', 'Panama', '2026-09-07 13:50:31.955468+05:30', '2026-09-07 13:50:31.955469+05:30');
INSERT INTO public.customers VALUES (70, 'The Warehouse Limited', 'New Zealand', '2026-09-07 13:50:31.955469+05:30', '2026-09-07 13:50:31.955469+05:30');
INSERT INTO public.customers VALUES (71, 'Accesorios Para Computadoras Y', 'Honduras', '2026-09-07 13:50:31.955469+05:30', '2026-09-07 13:50:31.95547+05:30');
INSERT INTO public.customers VALUES (72, 'C.R. Gibson LLC', 'USA', '2026-09-07 13:50:31.95547+05:30', '2026-09-07 13:50:31.95547+05:30');
INSERT INTO public.customers VALUES (73, 'Blue Marble Business Llc', 'USA', '2026-09-07 13:50:31.955471+05:30', '2026-09-07 13:50:31.955471+05:30');
INSERT INTO public.customers VALUES (75, 'Esflo Mkting Sa De Cv', 'Mexico', '2026-09-07 13:50:31.955472+05:30', '2026-09-07 13:50:31.955472+05:30');
INSERT INTO public.customers VALUES (76, 'Ross Procurement Inc', 'USA', '2026-09-07 13:50:31.955473+05:30', '2026-09-07 13:50:31.955473+05:30');
INSERT INTO public.customers VALUES (77, 'DD''s Discounts, A division of Ross', 'USA', '2026-09-07 13:50:31.955473+05:30', '2026-09-07 13:50:31.955473+05:30');
INSERT INTO public.customers VALUES (78, 'Homegoods Inc.', 'USA', '2026-09-07 13:50:31.955474+05:30', '2026-09-07 13:50:31.955474+05:30');
INSERT INTO public.customers VALUES (79, 'Marshalls of MA, Inc.', 'USA', '2026-09-07 13:50:31.955474+05:30', '2026-09-07 13:50:31.955475+05:30');
INSERT INTO public.customers VALUES (80, 'Newton Buying Corp. (T.J. Maxx)', 'USA', '2026-09-07 13:50:31.955475+05:30', '2026-09-07 13:50:31.955475+05:30');
INSERT INTO public.customers VALUES (81, 'Lancaster TX', 'USA', '2026-09-07 13:50:31.955476+05:30', '2026-09-07 13:50:31.955476+05:30');
INSERT INTO public.customers VALUES (83, 'Votum Enterprises LLC', 'USA', '2026-09-07 13:50:31.955477+05:30', '2026-09-07 13:50:31.955477+05:30');
INSERT INTO public.customers VALUES (84, 'AL Hathboor Group LLC (Branch) Jafza', 'UAE', '2026-09-07 13:50:31.955477+05:30', '2026-09-07 13:50:31.955478+05:30');
INSERT INTO public.customers VALUES (85, 'Masterstroke Stationers  Ltd', 'Kenya', '2026-09-07 13:50:31.955478+05:30', '2026-09-07 13:50:31.955478+05:30');
INSERT INTO public.customers VALUES (86, 'NORTHERN FIXTURES & FITTINGS (PTY) LTD', 'Botswana', '2026-09-07 13:50:31.955479+05:30', '2026-09-07 13:50:31.955479+05:30');
INSERT INTO public.customers VALUES (87, 'S. P. Richards Company', 'USA', '2026-09-07 13:50:31.955479+05:30', '2026-09-07 13:50:31.95548+05:30');
INSERT INTO public.customers VALUES (88, 'Al Dihli Golden Ent Trad', 'Oman', '2026-09-07 13:50:31.95548+05:30', '2026-09-07 13:50:31.95548+05:30');
INSERT INTO public.customers VALUES (89, 'Carrefour Italia S.P.A', 'Italy', '2026-09-07 13:50:31.955481+05:30', '2026-09-07 13:50:31.955481+05:30');
INSERT INTO public.customers VALUES (90, 'Carrefour RomÃ¢nia S.A', 'Romania', '2026-09-07 13:50:31.955481+05:30', '2026-09-07 13:50:31.955481+05:30');
INSERT INTO public.customers VALUES (91, 'Carrefour Belgium S.A.', 'Belgium', '2026-09-07 13:50:31.955482+05:30', '2026-09-07 13:50:31.955482+05:30');
INSERT INTO public.customers VALUES (92, 'Charope Inc', 'USA', '2026-09-07 13:50:31.955482+05:30', '2026-09-07 13:50:31.955483+05:30');
INSERT INTO public.customers VALUES (94, 'Carrefour Import SAS', 'France', '2026-09-07 13:50:31.955484+05:30', '2026-09-07 13:50:31.955484+05:30');
INSERT INTO public.customers VALUES (95, 'Lucky Star Enterprise & Co., Ltd.', 'Taiwan', '2026-09-07 13:50:31.955484+05:30', '2026-09-07 13:50:31.955485+05:30');
INSERT INTO public.customers VALUES (96, 'Butterfly Products (Pty) Ltd', 'South Africa', '2026-09-07 13:50:31.955485+05:30', '2026-09-07 13:50:31.955486+05:30');
INSERT INTO public.customers VALUES (98, 'Ppos Warehouse', 'New Zealand', '2026-09-07 13:50:31.955487+05:30', '2026-09-07 13:50:31.955487+05:30');
INSERT INTO public.customers VALUES (100, 'Impretto,C.A', 'Venezuela', '2026-09-07 13:50:31.955488+05:30', '2026-09-07 13:50:31.955489+05:30');
INSERT INTO public.customers VALUES (101, 'One Infinity General Trading F.Z.E.', 'UAE', '2026-09-07 13:50:31.955489+05:30', '2026-09-07 13:50:31.955489+05:30');
INSERT INTO public.customers VALUES (102, 'Ontario Inc', 'Canada', '2026-09-07 13:50:31.95549+05:30', '2026-09-07 13:50:31.95549+05:30');
INSERT INTO public.customers VALUES (103, 'Carrefour Polska SP. Z.O.O', 'Poland', '2026-09-07 13:50:31.95549+05:30', '2026-09-07 13:50:31.955491+05:30');
INSERT INTO public.customers VALUES (104, 'Centros Comerciales Carrefour  Sa', 'Spain', '2026-09-07 13:50:31.955491+05:30', '2026-09-07 13:50:31.955491+05:30');
INSERT INTO public.customers VALUES (105, 'Shinyanga Emporium (1978) LTD', 'Tanzania', '2026-09-07 13:50:31.955492+05:30', '2026-09-07 13:50:31.955492+05:30');
INSERT INTO public.customers VALUES (106, 'Agencias Motta,S.A', 'Panama', '2026-09-07 13:50:31.955492+05:30', '2026-09-07 13:50:31.955493+05:30');
INSERT INTO public.customers VALUES (107, 'Leeds World Inc', 'USA', '2026-09-07 13:50:31.955493+05:30', '2026-09-07 13:50:31.955493+05:30');
INSERT INTO public.customers VALUES (109, 'Siplec', 'France', '2026-09-07 13:50:31.955494+05:30', '2026-09-07 13:50:31.955495+05:30');
INSERT INTO public.customers VALUES (110, 'Ideastream Consumer Products, LLC.', 'USA', '2026-09-07 13:50:31.955495+05:30', '2026-09-07 13:50:31.955495+05:30');
INSERT INTO public.customers VALUES (111, 'Sachu Traders', 'Liberia', '2026-09-07 13:50:31.955496+05:30', '2026-09-07 13:50:31.955496+05:30');
INSERT INTO public.customers VALUES (112, 'Dayspring Cards, Inc.', 'USA', '2026-09-07 13:50:31.955496+05:30', '2026-09-07 13:50:31.955496+05:30');
INSERT INTO public.customers VALUES (113, 'The Willman Sales Company Ltd', 'Jamaica', '2026-09-07 13:50:31.955497+05:30', '2026-09-07 13:50:31.955497+05:30');
INSERT INTO public.customers VALUES (114, 'Officeworks Ltd', 'Australia', '2026-09-07 13:50:31.955497+05:30', '2026-09-07 13:50:31.955498+05:30');
INSERT INTO public.customers VALUES (115, 'International Customer Service Company', 'China', '2026-09-07 13:50:31.955498+05:30', '2026-09-07 13:50:31.955498+05:30');
INSERT INTO public.customers VALUES (116, 'Hallmark Cards (Hk) Limited', 'Hong Kong', '2026-09-07 13:50:31.955499+05:30', '2026-09-07 13:50:31.955499+05:30');
INSERT INTO public.customers VALUES (117, 'Walmart Chile S.A.', 'Chile', '2026-09-07 13:50:31.955499+05:30', '2026-09-07 13:50:31.9555+05:30');
INSERT INTO public.customers VALUES (118, 'Shree General Trading Llc', 'UAE', '2026-09-07 13:50:31.9555+05:30', '2026-09-07 13:50:31.9555+05:30');
INSERT INTO public.customers VALUES (119, 'BSC Stationery sales (PTY)Ltd', 'South Africa', '2026-09-07 13:50:31.955501+05:30', '2026-09-07 13:50:31.955501+05:30');
INSERT INTO public.customers VALUES (120, 'Bab Tajoura Stationery & Office Tools', 'Libya', '2026-09-07 13:50:31.955501+05:30', '2026-09-07 13:50:31.955502+05:30');
INSERT INTO public.customers VALUES (121, 'Amazon CLT2', 'USA', '2026-09-07 13:50:31.955502+05:30', '2026-09-07 13:50:31.955502+05:30');
INSERT INTO public.customers VALUES (122, 'Amazon ORF2', 'USA', '2026-09-07 13:50:31.955503+05:30', '2026-09-07 13:50:31.955503+05:30');
INSERT INTO public.customers VALUES (123, 'Meijer Distribution Inc', 'USA', '2026-09-07 13:50:31.955503+05:30', '2026-09-07 13:50:31.955504+05:30');
INSERT INTO public.customers VALUES (124, 'Meijer Lansing Distribution', 'USA', '2026-09-07 13:50:31.955504+05:30', '2026-09-07 13:50:31.955504+05:30');
INSERT INTO public.customers VALUES (125, 'Meijer Tipp City Distribution', 'USA', '2026-09-07 13:50:31.955505+05:30', '2026-09-07 13:50:31.955505+05:30');
INSERT INTO public.customers VALUES (126, 'Chagrinovations LLC', 'USA', '2026-09-07 13:50:31.955505+05:30', '2026-09-07 13:50:31.955506+05:30');
INSERT INTO public.customers VALUES (128, 'AHLAM SAID MOH''D', 'Tanzania', '2026-09-07 13:50:31.955506+05:30', '2026-09-07 13:50:31.955507+05:30');
INSERT INTO public.customers VALUES (129, 'G.A.P Importers & Distibutors', 'Canada', '2026-09-07 13:50:31.955507+05:30', '2026-09-07 13:50:31.955507+05:30');
INSERT INTO public.customers VALUES (130, 'MEYRAKI GLOBAL', 'Germany', '2026-09-07 13:50:31.955508+05:30', '2026-09-07 13:50:31.955508+05:30');
INSERT INTO public.customers VALUES (131, 'Nadoli Pty Limited', 'Australia', '2026-09-07 13:50:31.955508+05:30', '2026-09-07 13:50:31.955509+05:30');
INSERT INTO public.customers VALUES (132, 'Bulletline', 'USA', '2026-09-07 13:50:31.955509+05:30', '2026-09-07 13:50:31.955509+05:30');
INSERT INTO public.customers VALUES (133, 'Gartner Studios', 'USA', '2026-09-07 13:50:31.95551+05:30', '2026-09-07 13:50:31.95551+05:30');
INSERT INTO public.customers VALUES (134, 'Kmart Australia', 'Australia', '2026-09-07 13:50:31.95551+05:30', '2026-09-07 13:50:31.955511+05:30');
INSERT INTO public.customers VALUES (135, 'New Customer-Ethopia', 'Ethiopia', '2026-09-07 13:50:31.955511+05:30', '2026-09-07 13:50:31.955511+05:30');
INSERT INTO public.customers VALUES (136, 'New Customer-DR Congo', 'Congo', '2026-09-07 13:50:31.955511+05:30', '2026-09-07 13:50:31.955512+05:30');
INSERT INTO public.customers VALUES (137, 'New Customer-Panama', 'Panama', '2026-09-07 13:50:31.955512+05:30', '2026-09-07 13:50:31.955512+05:30');
INSERT INTO public.customers VALUES (138, 'Brands To Retail, LLC', 'USA', '2026-09-07 13:50:31.955513+05:30', '2026-09-07 13:50:31.955514+05:30');
INSERT INTO public.customers VALUES (139, 'Union Stationery Co. Wll', 'Bahrain', '2026-09-07 13:50:31.955514+05:30', '2026-09-07 13:50:31.955514+05:30');
INSERT INTO public.customers VALUES (140, 'Navneet Development', 'USA', '2026-09-07 13:50:31.955515+05:30', '2026-09-07 13:50:31.955515+05:30');
INSERT INTO public.customers VALUES (141, 'EM AFRIQUE DISTRIBUTION', 'Ivory Coast', '2026-09-07 13:50:31.955515+05:30', '2026-09-07 13:50:31.955516+05:30');
INSERT INTO public.customers VALUES (142, 'SAS Organisation Intra-Groupe des Achats', 'France', '2026-09-07 13:50:31.955516+05:30', '2026-09-07 13:50:31.955516+05:30');
INSERT INTO public.customers VALUES (146, 'Othman Shadhil Mohamed', 'Tanzania', '2026-09-07 13:50:31.955519+05:30', '2026-09-07 13:50:31.955519+05:30');
INSERT INTO public.customers VALUES (147, 'Abundance Global - Fzco', 'UAE', '2026-09-07 13:50:31.955519+05:30', '2026-09-07 13:50:31.955519+05:30');
INSERT INTO public.customers VALUES (148, 'Brick N Click Inc.', 'USA', '2026-09-07 13:50:31.95552+05:30', '2026-09-07 13:50:31.95552+05:30');
INSERT INTO public.customers VALUES (149, 'Clas Ohlson', 'Sweden', '2026-09-07 13:50:31.95552+05:30', '2026-09-07 13:50:31.955521+05:30');
INSERT INTO public.customers VALUES (150, 'MPJ International Zona Libre S.A.', 'Panama', '2026-09-07 13:50:31.955521+05:30', '2026-09-07 13:50:31.955521+05:30');
INSERT INTO public.customers VALUES (151, 'Jain ConsultingÂ Engineers', 'Germany', '2026-09-07 13:50:31.955522+05:30', '2026-09-07 13:50:31.955522+05:30');
INSERT INTO public.customers VALUES (152, 'Rusta AB', 'Sweden', '2026-09-07 13:50:31.955522+05:30', '2026-09-07 13:50:31.955523+05:30');
INSERT INTO public.customers VALUES (153, 'PENMARKS LIMITED', 'Zambia', '2026-09-07 13:50:31.955523+05:30', '2026-09-07 13:50:31.955523+05:30');
INSERT INTO public.customers VALUES (154, 'Sherine Young', 'Jamaica', '2026-09-07 13:50:31.955524+05:30', '2026-09-07 13:50:31.955524+05:30');
INSERT INTO public.customers VALUES (155, 'Essendant Inc.', 'USA', '2026-09-07 13:50:31.955525+05:30', '2026-09-07 13:50:31.955526+05:30');
INSERT INTO public.customers VALUES (156, 'Spotlight Pty Ltd', 'Australia', '2026-09-07 13:50:31.955526+05:30', '2026-09-07 13:50:31.955526+05:30');
INSERT INTO public.customers VALUES (157, 'MEDIKING INC 19223', 'USA', '2026-09-07 13:50:31.955527+05:30', '2026-09-07 13:50:31.955527+05:30');
INSERT INTO public.customers VALUES (158, 'Wigston', 'United Kingdom', '2026-09-07 13:50:31.955527+05:30', '2026-09-07 13:50:31.955528+05:30');
INSERT INTO public.customers VALUES (159, 'Toy Ventures Limited', 'United Kingdom', '2026-09-07 13:50:31.955528+05:30', '2026-09-07 13:50:31.955528+05:30');
INSERT INTO public.customers VALUES (160, 'Target', 'USA', '2026-09-07 13:50:31.955529+05:30', '2026-09-07 13:50:31.955529+05:30');
INSERT INTO public.customers VALUES (161, 'HALLMARK CARDS INC', 'USA', '2026-09-07 13:50:31.955529+05:30', '2026-09-07 13:50:31.95553+05:30');
INSERT INTO public.customers VALUES (162, 'Inchcom', 'USA', '2026-09-07 13:50:31.95553+05:30', '2026-09-07 13:50:31.95553+05:30');
INSERT INTO public.customers VALUES (163, 'Interface SA Dominican', 'Dominican Rep.', '2026-09-07 13:50:31.955531+05:30', '2026-09-07 13:50:31.955531+05:30');
INSERT INTO public.customers VALUES (164, 'New Customer-Malawi', 'Malawi', '2026-09-07 13:50:31.955531+05:30', '2026-09-07 13:50:31.955531+05:30');
INSERT INTO public.customers VALUES (165, 'New Customer-Mozambique', 'Mozambique', '2026-09-07 13:50:31.955532+05:30', '2026-09-07 13:50:31.955532+05:30');
INSERT INTO public.customers VALUES (166, 'New Customer-Rwanda', 'Rwanda', '2026-09-07 13:50:31.955532+05:30', '2026-09-07 13:50:31.955533+05:30');
INSERT INTO public.customers VALUES (167, 'New Customer-Zambia', 'Zambia', '2026-09-07 13:50:31.955533+05:30', '2026-09-07 13:50:31.955533+05:30');
INSERT INTO public.customers VALUES (168, 'New Customer-Madagascar', 'Madagascar', '2026-09-07 13:50:31.955534+05:30', '2026-09-07 13:50:31.955534+05:30');
INSERT INTO public.customers VALUES (169, 'CHAMPS CORPORATION', 'Saudi Arabia', '2026-09-07 13:50:31.955534+05:30', '2026-09-07 13:50:31.955534+05:30');
INSERT INTO public.customers VALUES (170, 'STE RECYCLE SERVICE', 'Benin', '2026-09-07 13:50:31.955535+05:30', '2026-09-07 13:50:31.955535+05:30');
INSERT INTO public.customers VALUES (171, 'London Stationery Show', 'United Kingdom', '2026-09-07 13:50:31.955535+05:30', '2026-09-07 13:50:31.955536+05:30');
INSERT INTO public.customers VALUES (172, 'New Customer-Iraq', 'Iraq', '2026-09-07 13:50:31.955536+05:30', '2026-09-07 13:50:31.955536+05:30');
INSERT INTO public.customers VALUES (173, 'New Customer-Qatar', 'UAE', '2026-09-07 13:50:31.955537+05:30', '2026-09-07 13:50:31.955537+05:30');
INSERT INTO public.customers VALUES (174, 'New Customer-Bolivia', 'Bolivia', '2026-09-07 13:50:31.955537+05:30', '2026-09-07 13:50:31.955537+05:30');
INSERT INTO public.customers VALUES (175, 'New Customer-Guyana', 'Guyana', '2026-09-07 13:50:31.955538+05:30', '2026-09-07 13:50:31.955538+05:30');
INSERT INTO public.customers VALUES (176, 'New Customer-Chile', 'Chile', '2026-09-07 13:50:31.955538+05:30', '2026-09-07 13:50:31.955539+05:30');
INSERT INTO public.customers VALUES (177, 'Papeleria CCC', 'Dominican Rep.', '2026-09-07 13:50:31.955539+05:30', '2026-09-07 13:50:31.955539+05:30');
INSERT INTO public.customers VALUES (178, 'New Customer-Honduras', 'Honduras', '2026-09-07 13:50:31.95554+05:30', '2026-09-07 13:50:31.95554+05:30');
INSERT INTO public.customers VALUES (179, 'New Customer-Angola', 'Angola', '2026-09-07 13:50:31.95554+05:30', '2026-09-07 13:50:31.95554+05:30');
INSERT INTO public.customers VALUES (180, 'New Customer-Guinea Conakry', 'Guinea', '2026-09-07 13:50:31.955541+05:30', '2026-09-07 13:50:31.955541+05:30');
INSERT INTO public.customers VALUES (181, 'New Customer-Gambia', 'Gambia', '2026-09-07 13:50:31.955542+05:30', '2026-09-07 13:50:31.955542+05:30');
INSERT INTO public.customers VALUES (182, 'New Customer-Liberia', 'Liberia', '2026-09-07 13:50:31.955543+05:30', '2026-09-07 13:50:31.955543+05:30');
INSERT INTO public.customers VALUES (183, 'New Customer-Ghana', 'Ghana', '2026-09-07 13:50:31.955543+05:30', '2026-09-07 13:50:31.955544+05:30');
INSERT INTO public.customers VALUES (184, 'New Customer-Oman', 'Oman', '2026-09-07 13:50:31.955544+05:30', '2026-09-07 13:50:31.955544+05:30');
INSERT INTO public.customers VALUES (185, 'New Customer-Bahrain', 'Bahrain', '2026-09-07 13:50:31.955545+05:30', '2026-09-07 13:50:31.955545+05:30');
INSERT INTO public.customers VALUES (186, 'New Customer-Yemen', 'Yemen', '2026-09-07 13:50:31.955545+05:30', '2026-09-07 13:50:31.955546+05:30');
INSERT INTO public.customers VALUES (187, 'New Customer-Nicaragua', 'Nicaragua', '2026-09-07 13:50:31.955546+05:30', '2026-09-07 13:50:31.955546+05:30');
INSERT INTO public.customers VALUES (188, 'Snopake Brands', 'United Kingdom', '2026-09-07 13:50:31.955546+05:30', '2026-09-07 13:50:31.955547+05:30');
INSERT INTO public.customers VALUES (189, 'D.H.A. Siamwalla Ltd.', 'Thailand', '2026-09-07 13:50:31.955547+05:30', '2026-09-07 13:50:31.955547+05:30');
INSERT INTO public.customers VALUES (190, 'Maxim Sourcing', 'USA', '2026-09-07 13:50:31.955548+05:30', '2026-09-07 13:50:31.955548+05:30');
INSERT INTO public.customers VALUES (191, 'Hallmark Marketing Company LLC', 'USA', '2026-09-07 13:50:31.955548+05:30', '2026-09-07 13:50:31.955549+05:30');
INSERT INTO public.customers VALUES (192, 'Navin International', 'Panama', '2026-09-07 13:50:31.955549+05:30', '2026-09-07 13:50:31.955549+05:30');
INSERT INTO public.customers VALUES (193, 'Amazon Zona Libre', 'Panama', '2026-09-07 13:50:31.95555+05:30', '2026-09-07 13:50:31.95555+05:30');
INSERT INTO public.customers VALUES (194, 'Abouganem y Compania S.A', 'Panama', '2026-09-07 13:50:31.95555+05:30', '2026-09-07 13:50:31.955551+05:30');
INSERT INTO public.customers VALUES (195, 'Grosvenor House Papers Ltd', 'United Kingdom', '2026-09-07 13:50:31.955551+05:30', '2026-09-07 13:50:31.955551+05:30');
INSERT INTO public.customers VALUES (196, 'Aldi Nord', 'Germany', '2026-09-07 13:50:31.955551+05:30', '2026-09-07 13:50:31.955552+05:30');
INSERT INTO public.customers VALUES (197, 'RED ROBIN PUBLISHING LTD', 'United Kingdom', '2026-09-07 13:50:31.955552+05:30', '2026-09-07 13:50:31.955552+05:30');
INSERT INTO public.customers VALUES (198, 'ROSSMAN', 'Germany', '2026-09-07 13:50:31.955553+05:30', '2026-09-07 13:50:31.955553+05:30');
INSERT INTO public.customers VALUES (199, 'Maiktoli', 'New Zealand', '2026-09-07 13:50:31.955553+05:30', '2026-09-07 13:50:31.955554+05:30');
INSERT INTO public.customers VALUES (200, 'SHIVAM GENERAL TRADING', 'Niger', '2026-09-07 13:50:31.955554+05:30', '2026-09-07 13:50:31.955554+05:30');
INSERT INTO public.customers VALUES (201, 'THE GEM GROUP, INC.', 'USA', '2026-09-07 13:50:31.955554+05:30', '2026-09-07 13:50:31.955555+05:30');
INSERT INTO public.customers VALUES (202, 'BAHDELA CO. LTD', 'Tanzania', '2026-09-07 13:50:31.955555+05:30', '2026-09-07 13:50:31.955555+05:30');
INSERT INTO public.customers VALUES (203, 'EZONE ELECTRONICS', 'Ghana', '2026-09-07 13:50:31.955556+05:30', '2026-09-07 13:50:31.955556+05:30');
INSERT INTO public.customers VALUES (204, 'DIOUMA DIALLO', 'Senegal', '2026-09-07 13:50:31.955556+05:30', '2026-09-07 13:50:31.955557+05:30');
INSERT INTO public.customers VALUES (205, 'Flipkart India Private Limited', NULL, '2026-09-30 14:42:22.632195+05:30', '2026-09-30 14:42:22.632195+05:30');
INSERT INTO public.customers VALUES (206, 'Kokuyo Camlin Ltd', NULL, '2026-09-30 15:20:43.171238+05:30', '2026-09-30 15:20:43.171238+05:30');
INSERT INTO public.customers VALUES (207, 'Test Navneet Client', NULL, '2026-10-05 05:44:55.749384+05:30', '2026-10-05 05:44:55.749384+05:30');
INSERT INTO public.customers VALUES (208, 'Test Corporate Client', NULL, '2026-10-05 11:48:15.526231+05:30', '2026-10-05 11:48:15.526231+05:30');
INSERT INTO public.customers VALUES (209, 'Tata Consumer Products', NULL, '2026-10-05 17:24:09.420576+05:30', '2026-10-05 17:24:09.420576+05:30');
INSERT INTO public.customers VALUES (210, 'Test Customer', NULL, '2026-10-15 00:27:01.594553+05:30', '2026-10-15 00:27:01.594553+05:30');


--
-- Data for Name: plants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.plants VALUES (1, '1505', '1505 - Khaniwade', 'Khaniwade, Maharashtra', true, 'system', '2026-10-14 21:56:22.012735+05:30', '2026-10-14 21:56:22.012735+05:30');
INSERT INTO public.plants VALUES (2, '1508', '1508 - Vasai', 'Vasai, Maharashtra', true, 'system', '2026-10-14 21:56:22.012735+05:30', '2026-10-14 21:56:22.012735+05:30');
INSERT INTO public.plants VALUES (3, '1509', '1509 - Daman', 'Daman, UT', true, 'system', '2026-10-14 21:56:22.012735+05:30', '2026-10-14 21:56:22.012735+05:30');


--
-- Data for Name: product_characteristics; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_characteristics VALUES (1, 'PRODUCT_CLASS', 'PRODUCTCLOSESIZELENGTH', 1, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (2, 'PRODUCT_CLASS', 'PRODUCTCLOSESIZEWIDTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (3, 'PRODUCT_CLASS', 'FSCEUTR_REQUIREMENT', 3, NULL, '["FSC", "EUTR", "SUSTAINABLE", "NA", "FSC & EUDR", "FSC & EUTR", "SUSTAINABLE & EUTR"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (4, 'PRODUCT_CLASS', 'CLAIMAPPLICABLETOPRODUCT', 4, NULL, '["MIX", "RECYCLE", "PURE", "NA", "BAGGASSE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (5, 'PRODUCT_CLASS', 'PERCENTAGE_TYPE', 5, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (6, 'PRODUCT_CLASS', 'OVERALLPRODUCTNOTE', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (7, 'NB_BINDING', 'BINDINGTYPE1', 1, NULL, '["Refer To Special Binding", "Case with Round Spine", "Case Bound", "Split Case", "Full Bound Stiff Cover", "Soft Cover", "Double Pasted (3 Layers)", "Full Bound", "Full Bound Double Pasted", "Unbound", "NA", "Perfect Bound", "Stiff Cover", "File Folder", "Envelope", "Flapover", "Portfolio"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-11 14:26:27.296332+05:30');
INSERT INTO public.product_characteristics VALUES (8, 'NB_BINDING', 'BINDINGTYPE2', 2, NULL, '["Refer To Special Binding", "Center sewn", "Section Pin", "Section Sewn", "Section Sewn with Open Spine", "Spiral", "Wiro", "Split Wiro (Wiro at Distance)", "Center sewn & Locked", "Center Pin", "Covered Spine Wiro", "Covered Spine Spiral", "Disc Binding", "Legal Pad Style Full Strip", "Legal Pad Style Partial Strip", "Cut and Sewn", "Head Stappled", "Glued", "Glued + Head Stappled", "Glued + Head Stappled + Turned", "Refill Style Glued + Tape", "Duplicate Style Glued + Tape", "Flapover", "Match Book Style", "Twisted Glued", "NA", "Poly Box w/Elastic Band", "Ring Bound", "Perfect Bound", "Binder", "Plastic Spiral", "Stappled", "Wiro with hanger", "Creasing and folding", "Prong Style Binding", "Section Glued", "Lever Arch File", "Poly Box"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (9, 'NB_BINDING', 'OPENINGOFPRODUCT', 3, NULL, '["English Opening", "Arabic Opening", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (10, 'NB_BINDING', 'BINDINGSIDE', 4, NULL, '["LONG SIDE", "SHORT SIDE", "LONG SIDE WITH PERF", "SHORT SIDE WITH PERF", "NA", "ALL 4 SIDES", "CORNER"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (11, 'NB_BINDING', 'BINDINGMATERIAL', 5, NULL, '["REF TO BIND MATRL/COLOR/STYLE", "PLASTIC SPIRAL - FOLLOW COLOR", "GALVANIZED SPIRAL", "EXTRA THICK GALVANIZED SPIRAL", "METAL SPIRAL - FOLLOW COLOR", "METAL WIRO - FOLLOW COLOR", "CLOTH TAPE - FOLLOW COLOR", "BLEACHED KRAFT (STRONG) P TAPE", "SYNTHETIC TAPE - FOLLOW COLOR", "SYNTHETIC TAPE", "PVC COATED PAPER", "DISC - FOLLOW COLOR", "CANVAS WITH H&T BAND", "CANVAS", "PAPER TAPE", "NA", "METAL WIRO - PER FOLLOW COLOR", "CLOTH TAPE - PER FOLLOW COLOR", "PAPER TAPE - PER FOLLOW COLOR", "GLUED", "VINYLE COATED PAPER TAPE_PERF", "GALVANIZED WIRO", "TAPE", "METAL PIN - FOLLOW COLOUR", "RING", "CLIP MECHANISM LEVER ACRH"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (12, 'NB_BINDING', 'BINDINGCOLOR_STYLE', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (13, 'NB_BINDING', 'SPECIALBINDING', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (14, 'NB_BINDING', 'ADDITIONALPROCESSONBINDING', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (15, 'NB_BINDING', 'SPIRAL-WIROBINDINGHOLEPUNCH', 9, NULL, '["OVAL", "ROUND", "SQUARE", "NA", "REF TO ADD. PROCES ON BIND MAT", "REF TO NOTE", "MASHROOM PUNCH HOLES"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (16, 'NB_BINDING', 'FILINGHOLEPUNCHDIADISTANCE', 10, NULL, '["5MM X EU", "6.5MM X EU", "8 MM X EU", "5MM X US", "6.5MM X US", "8 MM X US", "UNIVERSAL", "NA", "REF TO ADDNL PROC ON BIND MAT"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (17, 'NB_BINDING', 'NOOFFILINGHOLESREQUIRE', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (18, 'NB_BINDING', 'FILLINGHOLESREQUIREDON', 12, NULL, '["FULL BOOK", "ONLY INSIDE RULED BLOCK", "NA", "REF TO ADDNL PROC ON BIND MAT", "INSIDE BLOCK W/DIVIDER"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (19, 'NB_BINDING', 'SPIRAL_WIROLOCK', 13, NULL, '["COIL LOCK", "TURNED IN", "NO SHARP EDGE", "NA", "REF TO ADDNL PROC ON BIND MAT"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (20, 'NB_BINDING', 'SPIRAL_WIRODIA', 14, NULL, '["STANDARD", "OVERSIZE - REF TO BINDING MATR", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (21, 'NB_BINDING', 'CORNERROUNDREQUIREON', 15, NULL, '["WHOLE BOOK - FINE", "WHOLE BOOK - STD", "ONLY ON CVR & BACK", "ONLY INSIDE BLOCK", "NA", "ONLY CVR & BACK", "ONLY ON COVER"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (22, 'NB_BINDING', 'CORNERROUNDINGRADIUS', 16, NULL, '["2 MM", "REF TO ADDNL PROC ON BIND MAT", "5 MM", "6 MM", "9 MM", "12 MM", "NA", "FACTORY STD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (23, 'NB_BINDING', 'EDGEFINISHIGTYPE', 17, NULL, '["REF TO ADDNL PROC ON BIND MAT", "COLOR EDGE", "DECORATIVE EDGE", "GILDING", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (24, 'NB_BINDING', 'EDGEFINISHINGSIDES', 18, NULL, '["REF TO ADDNL PROC ON BIND MAT", "ALL 4 SIDES", "BINDING SIDE ONLY", "3 OPEN SIDES", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (25, 'NB_BINDING', 'EDGEFINISHINGNOOFDESIGNS', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (26, 'NB_BINDING', 'EDGEFINISHINGDESIGNNOTES', 20, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (27, 'NB_BINDING', 'SHEETGATHERINGSTYLE', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (28, 'NB_BINDING', 'ACCESSORIES', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (29, 'NB_BINDING', 'ACCESSORIESDETAILS', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (30, 'NB_BINDING', 'CARENOTEFORBINDING', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (31, 'NB_COMPONENT_1', 'COMPONENT1NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (32, 'NB_COMPONENT_1', 'C1SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (33, 'NB_COMPONENT_1', 'C1SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (34, 'NB_COMPONENT_1', 'LENGTHAFTERPERFORATION', 4, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (35, 'NB_COMPONENT_1', 'WIDTHAFTERPERFORATION', 5, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (36, 'NB_COMPONENT_1', 'C1NOOFSHEETS', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (37, 'NB_COMPONENT_1', 'C1MATERIALTYPE', 7, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (38, 'NB_COMPONENT_1', 'C1MILL_SUPPLIERNAME', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (39, 'NB_COMPONENT_1', 'C1MILL_SUPLIER_QLTY_GRDE_FNSH', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (40, 'NB_COMPONENT_1', 'C1MATERIALCOLOR_VARIANCE', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (41, 'NB_COMPONENT_1', 'C1CALIPER_WEIGHT', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (42, 'NB_COMPONENT_1', 'C1MATERIALUNIT', 12, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (43, 'NB_COMPONENT_1', 'C1PURCHASECERTIFICATION', 13, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (44, 'NB_COMPONENT_1', 'C1CERTIFICATIONADDNLNOTE', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (45, 'NB_COMPONENT_1', 'C1TECHNICALRAWMATERIALSPEC', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (46, 'NB_COMPONENT_1', 'C1PRINTINGTYPE1', 16, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (47, 'NB_COMPONENT_1', 'C1NOOFDESIGNS_PRINT_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (48, 'NB_COMPONENT_1', 'C1NOOFCOLOURSF_B_1', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (49, 'NB_COMPONENT_1', 'C1NAMEOFCOLORSF_B_1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (50, 'NB_COMPONENT_1', 'C1RULING_PRINTDESIGNNAME1', 20, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (51, 'NB_COMPONENT_1', 'C1RULE_PRINTCODE1', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (52, 'NB_COMPONENT_1', 'C1PRINTINGTYPE2', 22, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (53, 'NB_COMPONENT_1', 'C1NOOFDESIGNS_PRINT', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (54, 'NB_COMPONENT_1', 'C1NOOFCOLOURSF_B', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (55, 'NB_COMPONENT_1', 'C1NAMEOFCOLORSF_B', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (56, 'NB_COMPONENT_1', 'C1RULING_PRINTDESIGNNAME2', 26, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (57, 'NB_COMPONENT_1', 'C1RULE_PRINTCODE2', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (58, 'NB_COMPONENT_1', 'C1PRINTNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (59, 'NB_COMPONENT_1', 'C1FINISHING', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (60, 'NB_COMPONENT_1', 'C1FINISHINGNOTE', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (61, 'NB_COMPONENT_1', 'C1SPECIALNOTE', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (62, 'NB_COMPONENT_1', 'C1ADDITIONALPROCESS', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (63, 'NB_COMPONENT_1', 'C1ADDITIONALINFO1', 33, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (64, 'NB_COMPONENT_1', 'C1ADDITIONALINFO2', 34, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (65, 'NB_COMPONENT_1', 'C1ADDITIONALINFO3', 35, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (66, 'NB_COMPONENT_2', 'COMPONENT2NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (67, 'NB_COMPONENT_2', 'C2SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (68, 'NB_COMPONENT_2', 'C2SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (69, 'NB_COMPONENT_2', 'C2LENGHTAFTERPERFORATION', 4, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (70, 'NB_COMPONENT_2', 'C2WIDTHAFTERPERFORATION', 5, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (71, 'NB_COMPONENT_2', 'C2NOOFSHEETS', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (72, 'NB_COMPONENT_2', 'C2MATERIALTYPE', 7, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (73, 'NB_COMPONENT_2', 'C2MILL_SUPPLIERNAME', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (74, 'NB_COMPONENT_2', 'C2MILL_SUPLIER_QLTY_GRDE_FNSH', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (75, 'NB_COMPONENT_2', 'C2MATERIALCOLOR_VARIANCE', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (76, 'NB_COMPONENT_2', 'C2CALIPER_WEIGHT', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (77, 'NB_COMPONENT_2', 'C2MATERIALUNIT', 12, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (78, 'NB_COMPONENT_2', 'C2PURCHASECERTIFICATION', 13, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (79, 'NB_COMPONENT_2', 'C2CERTIFICATIONADDNLNOTE', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (80, 'NB_COMPONENT_2', 'C2TECHNICALRAWMATERIALSPEC', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (81, 'NB_COMPONENT_2', 'C2PRINTINGTYPE1', 16, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (82, 'NB_COMPONENT_2', 'C2NOOFDESIGNS_PRINT_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (83, 'NB_COMPONENT_2', 'C2NOOFCOLOURSF_B_1', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (84, 'NB_COMPONENT_2', 'C2NAMEOFCOLORSF_B_1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (85, 'NB_COMPONENT_2', 'C2RULING_PRINTDESIGNNAME1', 20, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (86, 'NB_COMPONENT_2', 'C2RULE_PRINTCODE1', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (87, 'NB_COMPONENT_2', 'C2PRINTINGTYPE2', 22, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (88, 'NB_COMPONENT_2', 'C2NOOFDESIGNS_PRINT', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (89, 'NB_COMPONENT_2', 'C2NOOFCOLOURSF_B', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (90, 'NB_COMPONENT_2', 'C2NAMEOFCOLORSF_B', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (91, 'NB_COMPONENT_2', 'C2RULING_PRINTDESIGNNAME2', 26, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (92, 'NB_COMPONENT_2', 'C2RULE_PRINTCODE2', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (93, 'NB_COMPONENT_2', 'C2PRINTNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (94, 'NB_COMPONENT_2', 'C2FINISHING', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (95, 'NB_COMPONENT_2', 'C2COVERENHANCEMENT', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (96, 'NB_COMPONENT_2', 'C2FINISHINGNOTE', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (97, 'NB_COMPONENT_2', 'C2SPECIALNOTE', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (98, 'NB_COMPONENT_2', 'C2ADDITIONALPROCESS', 33, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (99, 'NB_COMPONENT_2', 'C2ADDITIONALINFO1', 34, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (100, 'NB_COMPONENT_2', 'C2ADDITIONALINFO2', 35, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (101, 'NB_COMPONENT_2', 'C2ADDITIONALINFO3', 36, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (102, 'NB_COMPONENT_3', 'COMPONENT3NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (103, 'NB_COMPONENT_3', 'C3SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (104, 'NB_COMPONENT_3', 'C3SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (105, 'NB_COMPONENT_3', 'C3LENGHTAFTERPERFORATION', 4, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (106, 'NB_COMPONENT_3', 'C3WIDTHAFTERPERFORATION', 5, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (107, 'NB_COMPONENT_3', 'C3NOOFSHEETS', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (108, 'NB_COMPONENT_3', 'C3MATERIALTYPE', 7, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (109, 'NB_COMPONENT_3', 'C3MILL_SUPPLIERNAME', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (110, 'NB_COMPONENT_3', 'C3MILL_SUPLIER_QLTY_GRDE_FNSH', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (111, 'NB_COMPONENT_3', 'C3MATERIALCOLOR_VARIANCE', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (112, 'NB_COMPONENT_3', 'C3CALIPER_WEIGHT', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (113, 'NB_COMPONENT_3', 'C3MATERIALUNIT', 12, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (114, 'NB_COMPONENT_3', 'C3PURCHASECERTIFICATION', 13, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (115, 'NB_COMPONENT_3', 'C3CERTIFICATIONADDNLNOTE', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (116, 'NB_COMPONENT_3', 'C3TECHNICALRAWMATERIALSPEC', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (117, 'NB_COMPONENT_3', 'C3PRINTINGTYPE1', 16, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (118, 'NB_COMPONENT_3', 'C3NOOFDESIGNS_PRINT_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (119, 'NB_COMPONENT_3', 'C3NOOFCOLOURSF_B_1', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (120, 'NB_COMPONENT_3', 'C3NAMEOFCOLORSF_B_1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (121, 'NB_COMPONENT_3', 'C3RULING_PRINTDESIGNNAME1', 20, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (122, 'NB_COMPONENT_3', 'C3RULE_PRINTCODE1', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (123, 'NB_COMPONENT_3', 'C3PRINTINGTYPE2', 22, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (124, 'NB_COMPONENT_3', 'C3NOOFDESIGNS_PRINT', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (125, 'NB_COMPONENT_3', 'C3NOOFCOLOURSF_B', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (126, 'NB_COMPONENT_3', 'C3NAMEOFCOLORSF_B', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (127, 'NB_COMPONENT_3', 'C3RULING_PRINTDESIGNNAME2', 26, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (128, 'NB_COMPONENT_3', 'C3RULE_PRINTCODE2', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (129, 'NB_COMPONENT_3', 'C3PRINTNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (130, 'NB_COMPONENT_3', 'C3FINISHING', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (131, 'NB_COMPONENT_3', 'C3FINISHINGNOTE', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (132, 'NB_COMPONENT_3', 'C3SPECIALNOTE', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (133, 'NB_COMPONENT_3', 'C3ADDITIONALPROCESS', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (134, 'NB_COMPONENT_3', 'C3ADDITIONALINFO1', 33, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (135, 'NB_COMPONENT_3', 'C3ADDITIONALINFO2', 34, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (136, 'NB_COMPONENT_3', 'C3ADDITIONALINFO3', 35, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (137, 'NB_COMPONENT_4', 'COMPONENT4NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (138, 'NB_COMPONENT_4', 'C4SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (139, 'NB_COMPONENT_4', 'C4SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (140, 'NB_COMPONENT_4', 'C4LENGHTAFTERPERFORATION', 4, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (141, 'NB_COMPONENT_4', 'C4WIDTHAFTERPERFORATION', 5, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (142, 'NB_COMPONENT_4', 'C4NOOFSHEETS', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (143, 'NB_COMPONENT_4', 'C4MATERIALTYPE', 7, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (144, 'NB_COMPONENT_4', 'C4MILL_SUPPLIERNAME', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (145, 'NB_COMPONENT_4', 'C4MILL_SUPLIER_QLTY_GRDE_FNSH', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (146, 'NB_COMPONENT_4', 'C4MATERIALCOLOR_VARIANCE', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (147, 'NB_COMPONENT_4', 'C4CALIPER_WEIGHT', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (148, 'NB_COMPONENT_4', 'C4MATERIALUNIT', 12, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (149, 'NB_COMPONENT_4', 'C4PURCHASECERTIFICATION', 13, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (150, 'NB_COMPONENT_4', 'C4CERTIFICATIONADDNLNOTE', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (151, 'NB_COMPONENT_4', 'C4TECHNICALRAWMATERIALSPEC', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (152, 'NB_COMPONENT_4', 'C4PRINTINGTYPE1', 16, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (153, 'NB_COMPONENT_4', 'C4NOOFDESIGNS_PRINT_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (154, 'NB_COMPONENT_4', 'C4NOOFCOLOURSF_B_1', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (155, 'NB_COMPONENT_4', 'C4NAMEOFCOLORSF_B_1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (156, 'NB_COMPONENT_4', 'C4RULING_PRINTDESIGNNAME1', 20, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (157, 'NB_COMPONENT_4', 'C4RULE_PRINTCODE1', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (158, 'NB_COMPONENT_4', 'C4PRINTINGTYPE2', 22, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (159, 'NB_COMPONENT_4', 'C4NOOFDESIGNS_PRINT', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (160, 'NB_COMPONENT_4', 'C4NOOFCOLOURSF_B', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (161, 'NB_COMPONENT_4', 'C4NAMEOFCOLORSF_B', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (162, 'NB_COMPONENT_4', 'C4RULING_PRINTDESIGNNAME2', 26, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (163, 'NB_COMPONENT_4', 'C4RULE_PRINTCODE2', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (164, 'NB_COMPONENT_4', 'C4PRINTNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (165, 'NB_COMPONENT_4', 'C4FINISHING', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (166, 'NB_COMPONENT_4', 'C4FINISHINGNOTE', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (167, 'NB_COMPONENT_4', 'C4SPECIALNOTE', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (168, 'NB_COMPONENT_4', 'C4ADDITIONALPROCESS', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (169, 'NB_COMPONENT_4', 'C4ADDITIONALINFO1', 33, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (170, 'NB_COMPONENT_4', 'C4ADDITIONALINFO2', 34, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (171, 'NB_COMPONENT_4', 'C4ADDITIONALINFO3', 35, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (172, 'NB_COMPONENT_5', 'COMPONENT5NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (173, 'NB_COMPONENT_5', 'C5SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (174, 'NB_COMPONENT_5', 'C5SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (175, 'NB_COMPONENT_5', 'C5NOOFSHEETS', 4, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (176, 'NB_COMPONENT_5', 'C5MATERIALTYPE', 5, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (177, 'NB_COMPONENT_5', 'C5MILL_SUPPLIERNAME', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (178, 'NB_COMPONENT_5', 'C5MILL_SUPLIER_QLTY_GRDE_FNSH', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (179, 'NB_COMPONENT_5', 'C5MATERIALCOLOR_VARIANCE', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (180, 'NB_COMPONENT_5', 'C5CALIPER_WEIGHT', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (181, 'NB_COMPONENT_5', 'C5MATERIALUNIT', 10, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (182, 'NB_COMPONENT_5', 'C5PURCHASECERTIFICATION', 11, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (183, 'NB_COMPONENT_5', 'C5CERTIFICATIONADDNLNOTE', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (184, 'NB_COMPONENT_5', 'C5TECHNICALRAWMATERIALSPEC', 13, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (185, 'NB_COMPONENT_5', 'C5PRINTINGTYPE1', 14, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (186, 'NB_COMPONENT_5', 'C5NOOFDESIGNS_PRINT_1', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (187, 'NB_COMPONENT_5', 'C5NOOFCOLOURSF_B_1', 16, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (188, 'NB_COMPONENT_5', 'C5NAMEOFCOLORSF_B_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (189, 'NB_COMPONENT_5', 'C5RULING_PRINTDESIGNNAME1', 18, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (190, 'NB_COMPONENT_5', 'C5RULE_PRINTCODE1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (191, 'NB_COMPONENT_5', 'C5PRINTINGTYPE2', 20, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (192, 'NB_COMPONENT_5', 'C5NOOFDESIGNS_PRINT', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (193, 'NB_COMPONENT_5', 'C5NOOFCOLOURSF_B', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (194, 'NB_COMPONENT_5', 'C5NAMEOFCOLORSF_B', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (195, 'NB_COMPONENT_5', 'C5RULING_PRINTDESIGNNAME2', 24, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (196, 'NB_COMPONENT_5', 'C5RULE_PRINTCODE2', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (197, 'NB_COMPONENT_5', 'C5PRINTNOTE', 26, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (198, 'NB_COMPONENT_5', 'C5FINISHING', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (199, 'NB_COMPONENT_5', 'C5FINISHINGNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (200, 'NB_COMPONENT_5', 'C5SPECIALNOTE', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (201, 'NB_COMPONENT_5', 'C5ADDITIONALPROCESS', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (202, 'NB_COMPONENT_6', 'COMPONENT6NAME', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (203, 'NB_COMPONENT_6', 'C6SIZELENGTH', 2, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (204, 'NB_COMPONENT_6', 'C6SIZEWIDTH', 3, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (205, 'NB_COMPONENT_6', 'C6NOOFSHEETS', 4, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (206, 'NB_COMPONENT_6', 'C6MATERIALTYPE', 5, NULL, '["REF TO SPECIAL NOTE", "PAPER", "POLY", "PU", "PVC CLOTH PAPER", "PVC", "FABRIC", "PEALABLE STICKER", "PERMT STICKER", "WOOD", "BOARD"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (207, 'NB_COMPONENT_6', 'C6MILL_SUPPLIERNAME', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (208, 'NB_COMPONENT_6', 'C6MILL_SUPLIER_QLTY_GRDE_FNSH', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (209, 'NB_COMPONENT_6', 'C6MATERIALCOLOR_VARIANCE', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (210, 'NB_COMPONENT_6', 'C6CALIPER_WEIGHT', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (211, 'NB_COMPONENT_6', 'C6MATERIALUNIT', 10, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (212, 'NB_COMPONENT_6', 'C6PURCHASECERTIFICATION', 11, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (213, 'NB_COMPONENT_6', 'C6CERTIFICATIONADDNLNOTE', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (214, 'NB_COMPONENT_6', 'C6TECHNICALRAWMATERIALSPEC', 13, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (215, 'NB_COMPONENT_6', 'C6PRINTINGTYPE1', 14, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (216, 'NB_COMPONENT_6', 'C6NOOFDESIGNS_PRINT_1', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (217, 'NB_COMPONENT_6', 'C6NOOFCOLOURSF_B_1', 16, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (218, 'NB_COMPONENT_6', 'C6NAMEOFCOLORSF_B_1', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (278, 'NB_DIVIDER_SPECS', 'D1NAMEOFCOLORSF_B', 20, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (219, 'NB_COMPONENT_6', 'C6RULING_PRINTDESIGNNAME1', 18, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (220, 'NB_COMPONENT_6', 'C6RULE_PRINTCODE1', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (221, 'NB_COMPONENT_6', 'C6PRINTINGTYPE2', 20, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (222, 'NB_COMPONENT_6', 'C6NOOFDESIGNS_PRINT', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (223, 'NB_COMPONENT_6', 'C6NOOFCOLOURSF_B', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (224, 'NB_COMPONENT_6', 'C6NAMEOFCOLORSF_B', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (225, 'NB_COMPONENT_6', 'C6RULING_PRINTDESIGNNAME2', 24, NULL, '["SINGLE LINE", "SINGLE LINE EDGE CUT RULED", "COLLEGE RULED", "COLLEGE EDGE CUT RULED", "WIDE RULED", "WIDE EDGE CUT RULED", "FRENCH/SEYES RULED", "DOUBLE LINE \"PAUTADO\" RULED", "PAUTADO RULED", "NA", "NARROW RULED", "NARROW EDGE CUT RULED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (226, 'NB_COMPONENT_6', 'C6RULE_PRINTCODE2', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (227, 'NB_COMPONENT_6', 'C6PRINTNOTE', 26, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (228, 'NB_COMPONENT_6', 'C6FINISHING', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (229, 'NB_COMPONENT_6', 'C6FINISHINGNOTE', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (230, 'NB_COMPONENT_6', 'C6SPECIALNOTE', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (231, 'NB_COMPONENT_6', 'C6ADDITIONALPROCESS', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (232, 'NB_COMPONENT_7', 'C7PRODUCT_TYPE', 1, NULL, '["CANVAS FRAME", "CANVAS PANNEL"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (233, 'NB_COMPONENT_7', 'C7CANVAS_MATERIAL', 2, NULL, '["PLAIN WEAVE", "DUCK WEAVE", "SPECIAL"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (234, 'NB_COMPONENT_7', 'C7CONSTRUCTION_REEDXPICK', 3, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (235, 'NB_COMPONENT_7', 'C7COUNT_REEDXPICK', 4, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (236, 'NB_COMPONENT_7', 'C7NOTE_FOR_CANVAS', 5, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (237, 'NB_COMPONENT_7', 'C7MATERIAL_TYPE', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (238, 'NB_COMPONENT_7', 'C7MILL_SUPPLIERNAME', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (239, 'NB_COMPONENT_7', 'C7MILL_SUPLIER_QLTY_GRDE_FNSH', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (240, 'NB_COMPONENT_7', 'C7MATERIAL_COLOUR', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (241, 'NB_COMPONENT_7', 'C7MATERIAL_CERTIFICATION', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (242, 'NB_COMPONENT_7', 'C7FINISHING', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (243, 'NB_COMPONENT_7', 'C7CALIPER_WEIGHT', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (244, 'NB_COMPONENT_7', 'C7MATERIALUNIT', 13, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (245, 'NB_COMPONENT_7', 'C7PANNEL_TYPE', 14, NULL, '["BOARD", "MDF"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (246, 'NB_COMPONENT_7', 'C71NCALIPER_WEIGHT', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (247, 'NB_COMPONENT_7', 'C71MATERIALUNIT', 16, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (248, 'NB_COMPONENT_7', 'C7MILL_SUPPLIERNAME2', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (249, 'NB_COMPONENT_7', 'C7MILL_SUPLIER_QLTY_GRDE_FNSH2', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (250, 'NB_COMPONENT_7', 'C7MDF_CERT', 19, NULL, '["CARB-P2", "CARB-P2+PROP65", "PROP65"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (251, 'NB_COMPONENT_7', 'C7SPECIAL_NOTE', 20, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (252, 'NB_COMPONENT_7', 'C7FRAME_MAT_TYPE', 21, NULL, '["PINE WOOD", "PAULOWNIA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (253, 'NB_COMPONENT_7', 'C7FRAME_INCH', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (254, 'NB_COMPONENT_7', 'C7FRAME_THICKNESS', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (255, 'NB_COMPONENT_7', 'C7FRAME_BACK_WIDTH', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (256, 'NB_COMPONENT_7', 'C7FRAME_TYPE', 25, NULL, '["TOUNGE & GROVE WITH WEDGES", "TOUNGE & GROVE", "MITERED"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (257, 'NB_COMPONENT_7', 'C7BEVEL_REQUIRED', 26, NULL, '["YES", "NO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (258, 'NB_COMPONENT_7', 'C7FRAME_CERT', 27, NULL, '["FSC", "EUTR", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (259, 'NB_DIVIDER_SPECS', 'NOOFDIVIDERSOFTYPE1', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (260, 'NB_DIVIDER_SPECS', 'DIVIDERSTYPE1', 2, NULL, '["FIXED", "REPOSITIONABLE", "LOOSE"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (261, 'NB_DIVIDER_SPECS', 'DIVIDERPOSITION1', 3, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (262, 'NB_DIVIDER_SPECS', 'TABSTYLEOF1STDIVIDERS', 4, NULL, '["NO TAB", "REGULAR TAB", "INSERTABLE FOLDED TAB", "INSERTABLE SEALED TAB", "ALONG WITH POCKET", "MYLAR TABS", "REF ADDITIONAL INFO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (263, 'NB_DIVIDER_SPECS', 'POCKETSTYLEOF1STDIVIDERS', 5, NULL, '["NO POCKET", "SINGLE POCKET", "TWO PART SINGLE POCKET", "F&B TWO POCKETS", "TWO PART DOUBLE POCKET", "DOUBLE WALL POCKET TWO SIDES", "FULL SLEEVE", "REF ADDITIONAL INFO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (264, 'NB_DIVIDER_SPECS', 'DIVIDER1SIZEINCLTABLENGTH', 6, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (265, 'NB_DIVIDER_SPECS', 'DIVIDER1SIZEWIDTH', 7, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (266, 'NB_DIVIDER_SPECS', 'DIVIDER1SIZEINCLTABWIDTH', 8, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (267, 'NB_DIVIDER_SPECS', 'DIVIDERMATERIALTYPE1', 9, NULL, '["REF SPL NOTE", "PAPER", "POLY"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (268, 'NB_DIVIDER_SPECS', 'D1MILL_SUPPLIER_SNAME', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (269, 'NB_DIVIDER_SPECS', 'D1MILL_SUPLIER_QLTY_GRDE_FNSH', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (270, 'NB_DIVIDER_SPECS', 'D1MATERIALCOLOR_VARIANCE', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (271, 'NB_DIVIDER_SPECS', 'D1DIVIDERCALIPER_WEIGHT', 13, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (272, 'NB_DIVIDER_SPECS', 'D1DIVIDERMATERIALUNIT', 14, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (273, 'NB_DIVIDER_SPECS', 'D1DIVIDERPURCHASECERT', 15, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (274, 'NB_DIVIDER_SPECS', 'D1DIVIDERTECHMATERIALSPEC', 16, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (275, 'NB_DIVIDER_SPECS', 'D1PRINTINGTYPE', 17, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (276, 'NB_DIVIDER_SPECS', 'D1NOOFDESIGNS_PRINT', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (277, 'NB_DIVIDER_SPECS', 'D1NOOFCOLOURSF_B', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (279, 'NB_DIVIDER_SPECS', 'D1PRINTFINISHING', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (280, 'NB_DIVIDER_SPECS', 'D1ADDITIONALINFOFORDIVIDER', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (281, 'NB_DIVIDER_SPECS', 'D1NOOFDIVIDERSOFTYPE2', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (282, 'NB_DIVIDER_SPECS', 'DIVIDERSTYPE2', 24, NULL, '["FIXED", "REPOSITIONABLE", "LOOSE"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (283, 'NB_DIVIDER_SPECS', 'DIVIDERPOSITION2', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (284, 'NB_DIVIDER_SPECS', 'TABSTYLEOF2NDDIVIDERS', 26, NULL, '["NO TAB", "REGULAR TAB", "INSERTABLE FOLDED TAB", "INSERTABLE SEALED TAB", "ALONG WITH POCKET", "MYLAR TABS", "REF ADDITIONAL INFO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (285, 'NB_DIVIDER_SPECS', 'POCKETSTYLEOFDIVIDERS', 27, NULL, '["NO POCKET", "SINGLE POCKET", "TWO PART SINGLE POCKET", "F&B TWO POCKETS", "TWO PART DOUBLE POCKET", "DOUBLE WALL POCKET TWO SIDES", "FULL SLEEVE", "REF ADDITIONAL INFO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (286, 'NB_DIVIDER_SPECS', 'DIVIDERSIZEINCLTABWIDTH', 28, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (287, 'NB_DIVIDER_SPECS', 'DIVIDERSIZEINCLTABLENGTH', 29, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (288, 'NB_DIVIDER_SPECS', 'DIVIDERMATERIALTYPE2', 30, NULL, '["REF SPL NOTE", "PAPER", "POLY"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (289, 'NB_DIVIDER_SPECS', 'D2MILL_SUPPLIER_SNAME', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (290, 'NB_DIVIDER_SPECS', 'D2MILL_SUPLIER_QLTY_GRDE_FNSH', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (291, 'NB_DIVIDER_SPECS', 'D2MATERIALCOLOR_VARIANCE', 33, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (292, 'NB_DIVIDER_SPECS', 'D2DIVIDERCALIPER_WEIGHT', 34, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (293, 'NB_DIVIDER_SPECS', 'D2DIVIDERMATERIALUNIT', 35, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (294, 'NB_DIVIDER_SPECS', 'D2DIVIDERPURCHASECERT', 36, NULL, '["FSC MIX", "FSC RECYCLED", "FSC PURE", "FSC MIX AND EUTR", "FSC RECYCLED AND EUTR", "FSC PURE AND EUTR", "EUTR", "NA", "RECYCLED", "BAGGASE", "OTHERS"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (295, 'NB_DIVIDER_SPECS', 'D2DIVIDERTECHMATERIALSPEC', 37, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (296, 'NB_DIVIDER_SPECS', 'D2PRINTINGTYPE', 38, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (297, 'NB_DIVIDER_SPECS', 'D2NOOFDESIGNS_PRINT', 39, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (298, 'NB_DIVIDER_SPECS', 'D2NOOFCOLOURSF_B', 40, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (299, 'NB_DIVIDER_SPECS', 'D2NAMEOFCOLORSF_B', 41, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (300, 'NB_DIVIDER_SPECS', 'D2PRINTFINISHING', 42, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (301, 'NB_DIVIDER_SPECS', 'D2ADDITIONALINFOFORDIVIDER', 43, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (302, 'PACKAGING_SPECS_1', 'PACKAGETYPE1', 1, NULL, '["REF TO SPL NOTE", "INSERTER", "BELLY BAND", "INFO SHEET", "HEADER CARD", "HANG TAG", "STICKER", "NA", "TRAY", "SHIRT BOX", "ENVELOPE PACKING", "PIZZA BOX", "PEELABLE STICKER", "PERMANENT STICKER", "TRANSPARENT STICKER", "SRP", "MAILER/ROLL END TUCK BOX", "TAFFETA LABEL", "CORRUGATED BOX"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (303, 'PACKAGING_SPECS_1', 'P1_APPLICATION', 2, NULL, '["AFTER PRODUCT IS BOUND", "BEFORE PRODUCT IS BOUND", "REF NOTE", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (304, 'PACKAGING_SPECS_1', 'P1_POSITIONING', 3, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (305, 'PACKAGING_SPECS_1', 'PACKAGING1SIZELENGTH', 4, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (306, 'PACKAGING_SPECS_1', 'PACKAGING1SIZEWIDTH', 5, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (307, 'PACKAGING_SPECS_1', 'PACKAGING1MATERIALTYPE', 6, NULL, '["REF TO SPL NOTE", "PAPER", "POLY", "PEALABLE STICKER", "PERMANENT STICKER", "SYNTHETIC STICKER", "PVC", "FABRIC"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (308, 'PACKAGING_SPECS_1', 'PACKAGINGMILL_SUPPLIERNAME', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (309, 'PACKAGING_SPECS_1', 'PCKGMILL_SUPPLIER_QLTY_GRADE', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (310, 'PACKAGING_SPECS_1', 'CALIPER_WEIGHT', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (311, 'PACKAGING_SPECS_1', 'MATERIALUNIT', 10, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (312, 'PACKAGING_SPECS_1', 'P1PRINTINGTYPE', 11, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (313, 'PACKAGING_SPECS_1', 'NOOFCOLOURSF_B', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (314, 'PACKAGING_SPECS_1', 'NAMEOFCOLORSF_B', 13, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (315, 'PACKAGING_SPECS_1', 'PACKAGING1FINISHING', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (316, 'PACKAGING_SPECS_1', 'ADDITIONALPROCESS', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (317, 'PACKAGING_SPECS_1', 'PACKAGING1SPECIALNOTE', 16, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (318, 'PACKAGING_SPECS_1', 'PACKAGETYPE2', 17, NULL, '["REF TO SPL NOTE", "INSERTER", "BELLY BAND", "INFO SHEET", "HEADER CARD", "HANG TAG", "STICKER", "NA", "TRAY", "SHIRT BOX", "ENVELOPE PACKING", "PIZZA BOX", "PEELABLE STICKER", "PERMANENT STICKER", "TRANSPARENT STICKER", "MAILER/ROLL END TUCK BOX", "RFID STICKER", "SEPERATOR"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (319, 'PACKAGING_SPECS_1', 'P2_APPLICATION', 18, NULL, '["AFTER PRODUCT IS BOUND", "BEFORE PRODUCT IS BOUND", "REF NOTE", "NA"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (320, 'PACKAGING_SPECS_1', 'P2_POSITIONING', 19, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (321, 'PACKAGING_SPECS_1', 'PACKAGING2SIZELENGTH', 20, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (322, 'PACKAGING_SPECS_1', 'PACKAGING2SIZEWIDTH', 21, 'CM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (323, 'PACKAGING_SPECS_1', 'PACKAGING2MATERIALTYPE', 22, NULL, '["REF TO SPL NOTE", "PAPER", "POLY", "PEALABLE STICKER"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (324, 'PACKAGING_SPECS_1', 'PACKAGINGMILL_SUPPLIERNAME2', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (325, 'PACKAGING_SPECS_1', 'PCKGMILL_SUPPLIER_QLTY_GRADE2', 24, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (326, 'PACKAGING_SPECS_1', 'CALIPER_WEIGHT2', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (327, 'PACKAGING_SPECS_1', 'MATERIALUNIT2', 26, NULL, '["REF TO SPECIAL NOTE", "GSM", "MICRONS", "OZ", "MM"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (328, 'PACKAGING_SPECS_1', 'P2PRINTINGTYPE', 27, NULL, '["FLEXO RULING", "NO PRINTING (BLANK)", "OFFSET VARIABLE BOOK PRTG", "OFFSET COMMON PRINT", "REF TO PRINT NOTE", "COATING", "TINTING", "SCREEN PRINTING", "GRAVIER", "DIGITAL PRINTING"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (329, 'PACKAGING_SPECS_1', 'NOOFCOLOURSF_B2', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (330, 'PACKAGING_SPECS_1', 'NAMEOFCOLORSF_B2', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (331, 'PACKAGING_SPECS_1', 'PACKAGING2FINISHING', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (332, 'PACKAGING_SPECS_1', 'ADDITIONALPROCESS2', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (333, 'PACKAGING_SPECS_1', 'PACKAGING2SPECIALNOTE', 32, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (334, 'RULLING_DETAILS', 'TOP_MARGIN', 1, 'MM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (335, 'RULLING_DETAILS', 'TOP_MARGIN_COLOR', 2, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (336, 'RULLING_DETAILS', 'LEFT_MARGIN', 3, 'MM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (337, 'RULLING_DETAILS', 'LEFT_MARGIN_COLOR', 4, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (338, 'RULLING_DETAILS', 'RIGHT_MARGIN', 5, 'MM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (339, 'RULLING_DETAILS', 'RIGHT_MARGIN_COLOR', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (340, 'RULLING_DETAILS', 'BOTTOM_MARGIN', 7, 'MM', '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (341, 'RULLING_DETAILS', 'BOTTOM_MARGIN_COLOR', 8, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (342, 'RULLING_DETAILS', 'CENTER_MARGIN_COLOR', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (343, 'RULLING_DETAILS', 'RULLING_PDF', 10, NULL, '["YES", "NO"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (344, 'RULLING_DETAILS', 'SPECIAL_RULING', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (345, 'RULLING_DETAILS', 'INSTRUCTION_RULLING', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (346, 'RULLING_DETAILS', 'RULLING_DISTANCE', 13, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (347, 'RULLING_DETAILS', 'RULLING_SHADE', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (348, 'PACKING_DETAILS', 'RETAILPACK_SALEUNITPACK', 1, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (349, 'PACKING_DETAILS', 'RETAILPACKTYPE', 2, NULL, '["NA", "SHRINK WRAP", "UNIV CARTON", "PDQ", "PERFORATED CARTON", "SHIRT BOX", "PEEL & SEAL BAG", "HEAT SEAL BAG", "ZIPPER BAG", "TRAY", "1 PLY BOX", "BLISTER", "CORRUGATED SHEET", "PIZZA STYLE CORRUG BOX", "REF TO SPL INSTRUCT", "POLY BOX W/CLOSURE", "OPP BAG", "POLY BAG", "MAIL/ROLL END TUCK BOX"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (350, 'PACKING_DETAILS', 'MATERIAL_SPECS', 3, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (351, 'PACKING_DETAILS', 'PRINTINGINSTRUCTION', 4, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (352, 'PACKING_DETAILS', 'DESIGN_COLORASSORTMENT', 5, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (353, 'PACKING_DETAILS', 'SPECIALINSTRUCTIONS', 6, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (354, 'PACKING_DETAILS', 'INNERPACKINGNOOFPCS', 7, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (355, 'PACKING_DETAILS', 'INNERPACKINGTYPE', 8, NULL, '["NA", "SHRINK WRAP", "UNIV CARTON", "PDQ", "PERFORATED CARTON", "SHIRT BOX", "PEEL & SEAL BAG", "HEAT SEAL BAG", "ZIPPER BAG", "TRAY", "1 PLY BOX", "BLISTER", "CORRUGATED SHEET", "PIZZA STYLE CORRUG BOX", "REF TO SPL INSTRUCT", "POLY BOX W/CLOSURE", "OPP BAG", "POLY BAG", "MAIL/ROLL END TUCK BOX"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (356, 'PACKING_DETAILS', 'INNERMATERIALSPECS', 9, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (357, 'PACKING_DETAILS', 'INNERSPECIALINSTRUCTIONS', 10, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (358, 'PACKING_DETAILS', 'INNERPRINTINGINSTRUCTION', 11, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (359, 'PACKING_DETAILS', 'I_WHNUMBEROFSALEUNITS', 12, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (360, 'PACKING_DETAILS', 'I_WHINNERPACKTYPE', 13, NULL, '["NA", "SHRINK WRAP", "UNIV CARTON", "PDQ", "PERFORATED CARTON", "SHIRT BOX", "PEEL & SEAL BAG", "HEAT SEAL BAG", "ZIPPER BAG", "TRAY", "1 PLY BOX", "BLISTER", "CORRUGATED SHEET", "PIZZA STYLE CORRUG BOX", "REF TO SPL INSTRUCT", "PE BAG", "PDQ WITH UNIVERSAL BOX", "PDQ WITH CAP"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (361, 'PACKING_DETAILS', 'MATERIAL_SPECS2', 14, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (362, 'PACKING_DETAILS', 'I_WHPRINTINGINSTRUCTION', 15, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (363, 'PACKING_DETAILS', 'DESIGN_COLORASSORTMENT2', 16, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (364, 'PACKING_DETAILS', 'I_WHSPECIALINSTRUCTIONS', 17, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (365, 'PACKING_DETAILS', 'MASTERNUMBEROFSALEUNITS', 18, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (366, 'PACKING_DETAILS', 'MASTERPACKTYPE', 19, NULL, '["STRAIGHT ON A PALLET", "UNIV CARTON", "PDQ", "PERFORATED CARTON", "CORRUGATED SHEET", "STORE READY LARGE DISPLAY CTN", "REF TO SPL INSTRUCT", "PDQ WITH CAP"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (367, 'PACKING_DETAILS', 'MASTERMATERIAL_SPECS', 20, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (368, 'PACKING_DETAILS', 'MASTERSTACKING_ASSORTTYPE', 21, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (369, 'PACKING_DETAILS', 'MASTERMARK_PRINTINSTR_POS', 22, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (370, 'PACKING_DETAILS', 'MASTERSPECIALINSTRUCTIONS', 23, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (371, 'PACKING_DETAILS', 'STUFFINGTYPE', 24, NULL, '["SLIP SHEET", "FUMIGATED PALLETS", "FLOOR LOADED", "REF TO SPECIAL INSTRUCTION"]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (372, 'PACKING_DETAILS', 'MAXPALLETSIZEALLOW_LXWXH', 25, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (373, 'PACKING_DETAILS', 'MAXPALLETWEIGHT', 26, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (374, 'PACKING_DETAILS', 'SPECIALINSTRUCTIONS2', 27, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (375, 'PACKING_DETAILS', 'TAPPINGDETAILS', 28, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (376, 'PACKING_DETAILS', 'PRODUCTBARCODE', 29, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (377, 'PACKING_DETAILS', 'INNERBARCODE', 30, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');
INSERT INTO public.product_characteristics VALUES (378, 'PACKING_DETAILS', 'MASTERBARCODE', 31, NULL, '[]', true, '2026-09-04 17:27:30.213134+05:30', '2026-09-04 17:27:30.213134+05:30');


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_migrations VALUES ('0001_legacy_schema_bootstrap', 'Record and run existing schema upgrades', '2026-10-15 11:34:58.255183+05:30');
INSERT INTO public.schema_migrations VALUES ('0002_feasibility_conversion_relations', 'Connect Feasibility conversions to sample requests', '2026-10-15 11:35:01.517733+05:30');
INSERT INTO public.schema_migrations VALUES ('0003_backfill_sample_request_activity', 'Normalize legacy sample and design workflow events', '2026-10-15 11:35:01.65756+05:30');
INSERT INTO public.schema_migrations VALUES ('0004_index_request_type_scopes', 'Index operational scopes and owner-filtered queues', '2026-10-15 11:35:01.934104+05:30');
INSERT INTO public.schema_migrations VALUES ('0005_sync_normalized_request_types', 'Synchronize relational scope flags from request records', '2026-10-15 11:35:02.10229+05:30');
INSERT INTO public.schema_migrations VALUES ('0006_preserve_feasibility_activity_history', 'Retain feasibility audit history when its request is deleted', '2026-10-15 11:35:02.221925+05:30');
INSERT INTO public.schema_migrations VALUES ('0007_costing_creative_handoff', 'Persist conditional Creative routing and its SLA deadline', '2026-10-15 12:11:57.738268+05:30');
INSERT INTO public.schema_migrations VALUES ('0008_complete_costing_creative_handoff_columns', 'Ensure all Costing Creative handoff fields exist', '2026-10-15 12:30:08.526668+05:30');
INSERT INTO public.schema_migrations VALUES ('0009_backfill_design_creation_activity', 'Normalize creation history for existing Design requests', '2026-10-16 14:41:46.02753+05:30');
INSERT INTO public.schema_migrations VALUES ('0010_backfill_activity_actor_ids', 'Attribute historical workflow logs to unambiguous users', '2026-10-16 14:45:52.672847+05:30');
INSERT INTO public.schema_migrations VALUES ('0011_high_concurrency_database_indexes', 'Add composite and covering indexes for 1000+ concurrency', '2026-10-16 15:19:08.346097+05:30');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (1, 'Parin D', 'Admin', 'parin.dedhia@navneet.com', '$2b$12$drPdjKCuBcwOc5q2GQcW1eT.YIx/pujhSwDUyx6a/0WwxmQZHWVna', 'admin', 'Super Admin', 'admin', false, NULL, 'rose', true, '2026-10-14 21:56:22.012735+05:30', '2026-10-16 16:56:46.917566+05:30');


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 210, true);


--
-- Name: plants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plants_id_seq', 3, true);


--
-- Name: product_characteristics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_characteristics_id_seq', 378, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- PostgreSQL database dump complete
--

\unrestrict V2kvf57klRMTdCsBE25aGdNjxs98ArEewIGlg82P0gLGebv6hCrYDTvLmS6W7xP

