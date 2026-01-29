export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      actuaciones_1603: {
        Row: {
          adjuntos: string[] | null
          created_at: string
          created_by: string | null
          expediente_id: string
          fecha_real: string
          id: string
          observaciones: string | null
          resultado: string | null
          tipo: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjuntos?: string[] | null
          created_at?: string
          created_by?: string | null
          expediente_id: string
          fecha_real: string
          id?: string
          observaciones?: string | null
          resultado?: string | null
          tipo: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjuntos?: string[] | null
          created_at?: string
          created_by?: string | null
          expediente_id?: string
          fecha_real?: string
          id?: string
          observaciones?: string | null
          resultado?: string | null
          tipo?: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actuaciones_1603_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes_1603"
            referencedColumns: ["id"]
          },
        ]
      }
      base_assignments: {
        Row: {
          base: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          base: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          base?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      base_certificaciones: {
        Row: {
          aviso_dias: number
          base_id: string
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at: string
          created_by: string | null
          id: string
          obligatoria: boolean
          periodo_inactividad_meses: number
          updated_at: string
          updated_by: string | null
          vigilar_vencimiento: boolean
        }
        Insert: {
          aviso_dias?: number
          base_id: string
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at?: string
          created_by?: string | null
          id?: string
          obligatoria?: boolean
          periodo_inactividad_meses?: number
          updated_at?: string
          updated_by?: string | null
          vigilar_vencimiento?: boolean
        }
        Update: {
          aviso_dias?: number
          base_id?: string
          certificacion_id?: string
          certificacion_nombre?: string
          certificacion_tipo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          obligatoria?: boolean
          periodo_inactividad_meses?: number
          updated_at?: string
          updated_by?: string | null
          vigilar_vencimiento?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "base_certificaciones_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases_conduccion"
            referencedColumns: ["id"]
          },
        ]
      }
      bases_conduccion: {
        Row: {
          activa: boolean
          codigo: string | null
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activa?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activa?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      certificaciones: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      expedientes_1603: {
        Row: {
          cerrado_por: string | null
          cierre_manual: boolean | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_expediente"]
          fecha_cierre: string | null
          fecha_fin_prevista: string
          fecha_inicio: string
          fecha_primer_servicio: string
          id: string
          maquinista_id: string
          observaciones: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente"]
          fecha_cierre?: string | null
          fecha_fin_prevista: string
          fecha_inicio?: string
          fecha_primer_servicio: string
          id?: string
          maquinista_id: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_expediente"]
          fecha_cierre?: string | null
          fecha_fin_prevista?: string
          fecha_inicio?: string
          fecha_primer_servicio?: string
          id?: string
          maquinista_id?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_1603_maquinista_id_fkey"
            columns: ["maquinista_id"]
            isOneToOne: true
            referencedRelation: "maquinistas"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinista_certificaciones: {
        Row: {
          aviso_dias: number
          certificacion_id: string
          created_at: string
          created_by: string | null
          fecha_ultimo_servicio: string | null
          id: string
          maquinista_id: string
          obligatoria: boolean
          periodo_inactividad_meses: number
          updated_at: string
          updated_by: string | null
          vigilar_vencimiento: boolean
        }
        Insert: {
          aviso_dias?: number
          certificacion_id: string
          created_at?: string
          created_by?: string | null
          fecha_ultimo_servicio?: string | null
          id?: string
          maquinista_id: string
          obligatoria?: boolean
          periodo_inactividad_meses?: number
          updated_at?: string
          updated_by?: string | null
          vigilar_vencimiento?: boolean
        }
        Update: {
          aviso_dias?: number
          certificacion_id?: string
          created_at?: string
          created_by?: string | null
          fecha_ultimo_servicio?: string | null
          id?: string
          maquinista_id?: string
          obligatoria?: boolean
          periodo_inactividad_meses?: number
          updated_at?: string
          updated_by?: string | null
          vigilar_vencimiento?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "maquinista_certificaciones_maquinista_id_fkey"
            columns: ["maquinista_id"]
            isOneToOne: false
            referencedRelation: "maquinistas"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinistas: {
        Row: {
          activo: boolean
          bajo_pe_1603: boolean
          base: string
          created_at: string
          created_by: string | null
          fecha_primer_servicio: string | null
          id: string
          matricula: string
          nombre_apellidos: string
          observaciones: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          bajo_pe_1603?: boolean
          base: string
          created_at?: string
          created_by?: string | null
          fecha_primer_servicio?: string | null
          id?: string
          matricula: string
          nombre_apellidos: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          bajo_pe_1603?: boolean
          base?: string
          created_at?: string
          created_by?: string | null
          fecha_primer_servicio?: string | null
          id?: string
          matricula?: string
          nombre_apellidos?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      partes: {
        Row: {
          acciones_tomadas: string | null
          archivo_url: string | null
          base: string | null
          causa: string | null
          confianza_global: number | null
          created_at: string
          created_by: string | null
          datos_extraidos: Json | null
          descripcion_hechos: string | null
          dudas_conflictos: string | null
          estado: Database["public"]["Enums"]["estado_parte"] | null
          fecha_parte: string | null
          firmante: string | null
          fuente_archivo: string | null
          hora_fin: string | null
          hora_inicio: string | null
          hora_parte: string | null
          id: string
          linea_tramo: string | null
          maquinista_id: string | null
          maquinista_texto: string | null
          minutos_retraso: number | null
          numero_parte: string | null
          observaciones: string | null
          responsable: string | null
          tipo_parte: Database["public"]["Enums"]["tipo_parte"] | null
          tren_servicio: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acciones_tomadas?: string | null
          archivo_url?: string | null
          base?: string | null
          causa?: string | null
          confianza_global?: number | null
          created_at?: string
          created_by?: string | null
          datos_extraidos?: Json | null
          descripcion_hechos?: string | null
          dudas_conflictos?: string | null
          estado?: Database["public"]["Enums"]["estado_parte"] | null
          fecha_parte?: string | null
          firmante?: string | null
          fuente_archivo?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          hora_parte?: string | null
          id?: string
          linea_tramo?: string | null
          maquinista_id?: string | null
          maquinista_texto?: string | null
          minutos_retraso?: number | null
          numero_parte?: string | null
          observaciones?: string | null
          responsable?: string | null
          tipo_parte?: Database["public"]["Enums"]["tipo_parte"] | null
          tren_servicio?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acciones_tomadas?: string | null
          archivo_url?: string | null
          base?: string | null
          causa?: string | null
          confianza_global?: number | null
          created_at?: string
          created_by?: string | null
          datos_extraidos?: Json | null
          descripcion_hechos?: string | null
          dudas_conflictos?: string | null
          estado?: Database["public"]["Enums"]["estado_parte"] | null
          fecha_parte?: string | null
          firmante?: string | null
          fuente_archivo?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          hora_parte?: string | null
          id?: string
          linea_tramo?: string | null
          maquinista_id?: string | null
          maquinista_texto?: string | null
          minutos_retraso?: number | null
          numero_parte?: string | null
          observaciones?: string | null
          responsable?: string | null
          tipo_parte?: Database["public"]["Enums"]["tipo_parte"] | null
          tren_servicio?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      plan_1603: {
        Row: {
          actuacion_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_bloque_1603"]
          etiqueta: string
          expediente_id: string
          fin_ventana: string
          id: string
          inicio_ventana: string
          orden: number
          tipo: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actuacion_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_bloque_1603"]
          etiqueta: string
          expediente_id: string
          fin_ventana: string
          id?: string
          inicio_ventana: string
          orden: number
          tipo: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actuacion_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_bloque_1603"]
          etiqueta?: string
          expediente_id?: string
          fin_ventana?: string
          id?: string
          inicio_ventana?: string
          orden?: number
          tipo?: Database["public"]["Enums"]["tipo_actuacion_1603"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_1603_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes_1603"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellidos: string | null
          created_at: string
          email: string
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          created_at?: string
          email: string
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_base: {
        Args: { _base: string; _user_id: string }
        Returns: boolean
      }
      cerrar_expedientes_1603_expirados: { Args: never; Returns: undefined }
      get_user_bases: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "mando"
      estado_bloque_1603: "Pendiente" | "En ventana" | "Vencida" | "Cumplida"
      estado_expediente: "Activo" | "Cerrado"
      estado_parte: "Nuevo" | "En revisión" | "Cerrado"
      tipo_actuacion_1603: "Acompañamiento" | "Registro" | "Alcohol" | "Drogas"
      tipo_parte: "Incidencia" | "Retraso" | "Avería" | "Seguridad" | "Otro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "mando"],
      estado_bloque_1603: ["Pendiente", "En ventana", "Vencida", "Cumplida"],
      estado_expediente: ["Activo", "Cerrado"],
      estado_parte: ["Nuevo", "En revisión", "Cerrado"],
      tipo_actuacion_1603: ["Acompañamiento", "Registro", "Alcohol", "Drogas"],
      tipo_parte: ["Incidencia", "Retraso", "Avería", "Seguridad", "Otro"],
    },
  },
} as const
