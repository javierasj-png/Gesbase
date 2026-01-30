-- First migration: just add the enum value
-- Add 'gestor' to app_role enum (admin de base - permisos admin solo para sus bases asignadas)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';