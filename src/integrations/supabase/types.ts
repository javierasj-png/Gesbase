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
      actuaciones_1201: {
        Row: {
          created_at: string | null
          descripcion: string | null
          expediente_id: string
          fecha_programada: string | null
          fecha_real: string | null
          id: string
          observaciones: string | null
          plan_id: string | null
          registrado_por: string | null
          resultado: string | null
          tipo_accion: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          expediente_id: string
          fecha_programada?: string | null
          fecha_real?: string | null
          id?: string
          observaciones?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          resultado?: string | null
          tipo_accion: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          expediente_id?: string
          fecha_programada?: string | null
          fecha_real?: string | null
          id?: string
          observaciones?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          resultado?: string | null
          tipo_accion?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actuaciones_1201_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes_1201"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actuaciones_1201_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_1201"
            referencedColumns: ["id"]
          },
        ]
      }
      actuaciones_1603: {
        Row: {
          created_at: string | null
          expediente_id: string
          fecha_programada: string | null
          fecha_real: string | null
          id: string
          indice_prever: number | null
          observaciones: string | null
          registrado_por: string | null
          resultado: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expediente_id: string
          fecha_programada?: string | null
          fecha_real?: string | null
          id?: string
          indice_prever?: number | null
          observaciones?: string | null
          registrado_por?: string | null
          resultado?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expediente_id?: string
          fecha_programada?: string | null
          fecha_real?: string | null
          id?: string
          indice_prever?: number | null
          observaciones?: string | null
          registrado_por?: string | null
          resultado?: string | null
          tipo?: string
          updated_at?: string | null
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
          base_nombre: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          base_nombre: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          base_nombre?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      base_certificaciones: {
        Row: {
          aviso_dias: number | null
          base_id: string
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at: string | null
          id: string
          obligatoria: boolean | null
          periodo_inactividad_meses: number | null
          updated_at: string | null
          vigilar_vencimiento: boolean | null
        }
        Insert: {
          aviso_dias?: number | null
          base_id: string
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at?: string | null
          id?: string
          obligatoria?: boolean | null
          periodo_inactividad_meses?: number | null
          updated_at?: string | null
          vigilar_vencimiento?: boolean | null
        }
        Update: {
          aviso_dias?: number | null
          base_id?: string
          certificacion_id?: string
          certificacion_nombre?: string
          certificacion_tipo?: string
          created_at?: string | null
          id?: string
          obligatoria?: boolean | null
          periodo_inactividad_meses?: number | null
          updated_at?: string | null
          vigilar_vencimiento?: boolean | null
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
          activa: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      certificaciones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id: string
          nombre: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: []
      }
      expedientes_1201: {
        Row: {
          cerrado_por: string | null
          cierre_manual: boolean | null
          created_at: string | null
          created_by: string | null
          descripcion_suceso: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_fin_prevista: string | null
          fecha_primer_servicio: string
          fecha_suceso: string | null
          id: string
          id_suceso: string
          maquinista_id: string
          observaciones: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descripcion_suceso?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_fin_prevista?: string | null
          fecha_primer_servicio: string
          fecha_suceso?: string | null
          id?: string
          id_suceso: string
          maquinista_id: string
          observaciones?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descripcion_suceso?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_fin_prevista?: string | null
          fecha_primer_servicio?: string
          fecha_suceso?: string | null
          id?: string
          id_suceso?: string
          maquinista_id?: string
          observaciones?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_1201_maquinista_id_fkey"
            columns: ["maquinista_id"]
            isOneToOne: false
            referencedRelation: "maquinistas"
            referencedColumns: ["id"]
          },
        ]
      }
      expedientes_1603: {
        Row: {
          cerrado_por: string | null
          cierre_manual: boolean | null
          created_at: string | null
          created_by: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_fin_prevista: string | null
          fecha_inicio: string
          fecha_primer_servicio: string | null
          id: string
          maquinista_id: string
          observaciones: string | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio: string
          fecha_primer_servicio?: string | null
          id?: string
          maquinista_id: string
          observaciones?: string | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cerrado_por?: string | null
          cierre_manual?: boolean | null
          created_at?: string | null
          created_by?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio?: string
          fecha_primer_servicio?: string | null
          id?: string
          maquinista_id?: string
          observaciones?: string | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_1603_maquinista_id_fkey"
            columns: ["maquinista_id"]
            isOneToOne: false
            referencedRelation: "maquinistas"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinista_certificaciones: {
        Row: {
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at: string | null
          fecha_obtencion: string | null
          fecha_ultimo_servicio: string | null
          id: string
          maquinista_id: string
          obtenida: boolean | null
          updated_at: string | null
        }
        Insert: {
          certificacion_id: string
          certificacion_nombre: string
          certificacion_tipo: string
          created_at?: string | null
          fecha_obtencion?: string | null
          fecha_ultimo_servicio?: string | null
          id?: string
          maquinista_id: string
          obtenida?: boolean | null
          updated_at?: string | null
        }
        Update: {
          certificacion_id?: string
          certificacion_nombre?: string
          certificacion_tipo?: string
          created_at?: string | null
          fecha_obtencion?: string | null
          fecha_ultimo_servicio?: string | null
          id?: string
          maquinista_id?: string
          obtenida?: boolean | null
          updated_at?: string | null
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
          activo: boolean | null
          apellidos: string
          bajo_pe_1603: boolean | null
          base: string
          created_at: string | null
          email: string | null
          fecha_ingreso: string | null
          fecha_primer_servicio: string | null
          id: string
          matricula: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellidos: string
          bajo_pe_1603?: boolean | null
          base: string
          created_at?: string | null
          email?: string | null
          fecha_ingreso?: string | null
          fecha_primer_servicio?: string | null
          id?: string
          matricula: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellidos?: string
          bajo_pe_1603?: boolean | null
          base?: string
          created_at?: string | null
          email?: string | null
          fecha_ingreso?: string | null
          fecha_primer_servicio?: string | null
          id?: string
          matricula?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      plan_1201: {
        Row: {
          actuacion_id: string | null
          created_at: string | null
          dia_desde_origen: number
          estado: string | null
          etiqueta: string
          expediente_id: string
          fecha_objetivo: string | null
          id: string
          obligatorio: boolean | null
          tipo: string
        }
        Insert: {
          actuacion_id?: string | null
          created_at?: string | null
          dia_desde_origen: number
          estado?: string | null
          etiqueta: string
          expediente_id: string
          fecha_objetivo?: string | null
          id?: string
          obligatorio?: boolean | null
          tipo: string
        }
        Update: {
          actuacion_id?: string | null
          created_at?: string | null
          dia_desde_origen?: number
          estado?: string | null
          etiqueta?: string
          expediente_id?: string
          fecha_objetivo?: string | null
          id?: string
          obligatorio?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_1201_actuacion_id_fkey"
            columns: ["actuacion_id"]
            isOneToOne: false
            referencedRelation: "actuaciones_1201"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_1201_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes_1201"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_1603: {
        Row: {
          actuacion_id: string | null
          created_at: string | null
          estado: string | null
          etiqueta: string | null
          expediente_id: string
          fin_ventana: string | null
          id: string
          inicio_ventana: string | null
          mes: number
          orden: number | null
          tipo: string
        }
        Insert: {
          actuacion_id?: string | null
          created_at?: string | null
          estado?: string | null
          etiqueta?: string | null
          expediente_id: string
          fin_ventana?: string | null
          id?: string
          inicio_ventana?: string | null
          mes: number
          orden?: number | null
          tipo: string
        }
        Update: {
          actuacion_id?: string | null
          created_at?: string | null
          estado?: string | null
          etiqueta?: string | null
          expediente_id?: string
          fin_ventana?: string | null
          id?: string
          inicio_ventana?: string | null
          mes?: number
          orden?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_1603_actuacion_id_fkey"
            columns: ["actuacion_id"]
            isOneToOne: false
            referencedRelation: "actuaciones_1603"
            referencedColumns: ["id"]
          },
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
          user_id: string
        }
        Insert: {
          apellidos?: string | null
          created_at?: string
          email: string
          id?: string
          nombre?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apellidos?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      can_access_base:
        | { Args: { _base_nombre: string; _user_id: string }; Returns: boolean }
        | { Args: { _base_nombre: string; _user_id: string }; Returns: boolean }
      can_admin_base:
        | { Args: { _base_nombre: string; _user_id: string }; Returns: boolean }
        | { Args: { _base_nombre: string; _user_id: string }; Returns: boolean }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
      recalcular_plan_1201: {
        Args: { _expediente_id: string; _fecha_origen: string }
        Returns: undefined
      }
      recalcular_plan_1603: {
        Args: { _expediente_id: string; _fecha_origen: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "mando" | "gestor"
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
      app_role: ["admin", "mando", "gestor"],
    },
  },
} as const
