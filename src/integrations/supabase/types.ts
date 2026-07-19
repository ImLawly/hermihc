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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admissions: {
        Row: {
          admission_date: string
          antecedentes_familiares: string | null
          antecedentes_ginecobstetricos: Json | null
          antecedentes_personales: string | null
          antecedentes_quirurgicos: string | null
          bed: string | null
          comentario_ingreso: string | null
          created_at: string
          created_by: string
          diagnostico_egreso: string | null
          discharge_at: string | null
          discharge_type: Database["public"]["Enums"]["discharge_type"] | null
          examen_fisico: Json | null
          habitos_psicobiologicos: string | null
          historia_enfermedad_actual: string | null
          id: string
          impresion_diagnostica: string | null
          labs_ingreso: string | null
          location: Database["public"]["Enums"]["location_type"]
          motivo_consulta: string | null
          patient_id: string
          record_status: Database["public"]["Enums"]["record_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          service: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string
        }
        Insert: {
          admission_date: string
          antecedentes_familiares?: string | null
          antecedentes_ginecobstetricos?: Json | null
          antecedentes_personales?: string | null
          antecedentes_quirurgicos?: string | null
          bed?: string | null
          comentario_ingreso?: string | null
          created_at?: string
          created_by: string
          diagnostico_egreso?: string | null
          discharge_at?: string | null
          discharge_type?: Database["public"]["Enums"]["discharge_type"] | null
          examen_fisico?: Json | null
          habitos_psicobiologicos?: string | null
          historia_enfermedad_actual?: string | null
          id?: string
          impresion_diagnostica?: string | null
          labs_ingreso?: string | null
          location: Database["public"]["Enums"]["location_type"]
          motivo_consulta?: string | null
          patient_id: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          service: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Update: {
          admission_date?: string
          antecedentes_familiares?: string | null
          antecedentes_ginecobstetricos?: Json | null
          antecedentes_personales?: string | null
          antecedentes_quirurgicos?: string | null
          bed?: string | null
          comentario_ingreso?: string | null
          created_at?: string
          created_by?: string
          diagnostico_egreso?: string | null
          discharge_at?: string | null
          discharge_type?: Database["public"]["Enums"]["discharge_type"] | null
          examen_fisico?: Json | null
          habitos_psicobiologicos?: string | null
          historia_enfermedad_actual?: string | null
          id?: string
          impresion_diagnostica?: string | null
          labs_ingreso?: string | null
          location?: Database["public"]["Enums"]["location_type"]
          motivo_consulta?: string | null
          patient_id?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          service?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          id: number
          operation: string
          performed_at: string
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          operation: string
          performed_at?: string
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          operation?: string
          performed_at?: string
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivered_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          delivered_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          added_at: string
          conversation_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          conversation_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          conversation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          admission_id: string
          contenido: string
          created_at: string
          created_by: string
          id: string
          note_at: string
          tipo: Database["public"]["Enums"]["note_type"]
        }
        Insert: {
          admission_id: string
          contenido: string
          created_at?: string
          created_by: string
          id?: string
          note_at: string
          tipo: Database["public"]["Enums"]["note_type"]
        }
        Update: {
          admission_id?: string
          contenido?: string
          created_at?: string
          created_by?: string
          id?: string
          note_at?: string
          tipo?: Database["public"]["Enums"]["note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string
          descripcion: string
          diagnostico_egreso_mesa: string | null
          expulsion_at: string
          id: string
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by: string
          descripcion: string
          diagnostico_egreso_mesa?: string | null
          expulsion_at: string
          id?: string
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string
          descripcion?: string
          diagnostico_egreso_mesa?: string | null
          expulsion_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      evolutions: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string
          diagnostico_actual: string | null
          evolution_at: string
          id: string
          objetivo: Json | null
          plan: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          subjetivo: string | null
          updated_at: string
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by: string
          diagnostico_actual?: string | null
          evolution_at: string
          id?: string
          objetivo?: Json | null
          plan?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          subjetivo?: string | null
          updated_at?: string
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string
          diagnostico_actual?: string | null
          evolution_at?: string
          id?: string
          objetivo?: Json | null
          plan?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          subjetivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      interconsultations: {
        Row: {
          admission_id: string
          comentario: string
          created_at: string
          created_by: string
          diagnosticos: string | null
          id: string
          responded_at: string | null
          responded_by: string | null
          respuesta: string | null
          target_service: Database["public"]["Enums"]["service_type"]
        }
        Insert: {
          admission_id: string
          comentario: string
          created_at?: string
          created_by: string
          diagnosticos?: string | null
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          respuesta?: string | null
          target_service: Database["public"]["Enums"]["service_type"]
        }
        Update: {
          admission_id?: string
          comentario?: string
          created_at?: string
          created_by?: string
          diagnosticos?: string | null
          id?: string
          responded_at?: string | null
          responded_by?: string | null
          respuesta?: string | null
          target_service?: Database["public"]["Enums"]["service_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interconsultations_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string
          id: string
          parametro: string
          sampled_at: string
          unidad: string | null
          valor: string
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by: string
          id?: string
          parametro: string
          sampled_at: string
          unidad?: string | null
          valor: string
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string
          id?: string
          parametro?: string
          sampled_at?: string
          unidad?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_orders: {
        Row: {
          admission_id: string
          created_at: string
          created_by: string
          id: string
          items: Json
          order_at: string
          record_status: Database["public"]["Enums"]["record_status"]
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          created_by: string
          id?: string
          items?: Json
          order_at: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          created_by?: string
          id?: string
          items?: Json
          order_at?: string
          record_status?: Database["public"]["Enums"]["record_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_orders_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_entries: {
        Row: {
          admission_id: string
          created_at: string
          du: string | null
          fc: number | null
          fcf: number | null
          fr: number | null
          id: string
          mf: string | null
          performed_by: string
          recorded_at: string
          sato2: number | null
          ta: string | null
          tam: number | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          du?: string | null
          fc?: number | null
          fcf?: number | null
          fr?: number | null
          id?: string
          mf?: string | null
          performed_by: string
          recorded_at: string
          sato2?: number | null
          ta?: string | null
          tam?: number | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          du?: string | null
          fc?: number | null
          fcf?: number | null
          fr?: number | null
          id?: string
          mf?: string | null
          performed_by?: string
          recorded_at?: string
          sato2?: number | null
          ta?: string | null
          tam?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_entries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      newborn_records: {
        Row: {
          apellidos: string | null
          apgar_1: number | null
          apgar_5: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          esfuerzo_respiratorio:
            | Database["public"]["Enums"]["respiratory_effort"]
            | null
          fecha_nacimiento: string | null
          id: string
          mother_admission_id: string
          mother_patient_id: string
          nombres: string | null
          notas_enfermeria: string | null
          pediatric_admission_id: string | null
          pediatric_notes: string | null
          pediatric_patient_id: string | null
          peso_gr: number | null
          sexo: Database["public"]["Enums"]["newborn_sex"] | null
          status: Database["public"]["Enums"]["newborn_status"]
          talla_cm: number | null
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          apgar_1?: number | null
          apgar_5?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          esfuerzo_respiratorio?:
            | Database["public"]["Enums"]["respiratory_effort"]
            | null
          fecha_nacimiento?: string | null
          id?: string
          mother_admission_id: string
          mother_patient_id: string
          nombres?: string | null
          notas_enfermeria?: string | null
          pediatric_admission_id?: string | null
          pediatric_notes?: string | null
          pediatric_patient_id?: string | null
          peso_gr?: number | null
          sexo?: Database["public"]["Enums"]["newborn_sex"] | null
          status?: Database["public"]["Enums"]["newborn_status"]
          talla_cm?: number | null
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          apgar_1?: number | null
          apgar_5?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          esfuerzo_respiratorio?:
            | Database["public"]["Enums"]["respiratory_effort"]
            | null
          fecha_nacimiento?: string | null
          id?: string
          mother_admission_id?: string
          mother_patient_id?: string
          nombres?: string | null
          notas_enfermeria?: string | null
          pediatric_admission_id?: string | null
          pediatric_notes?: string | null
          pediatric_patient_id?: string | null
          peso_gr?: number | null
          sexo?: Database["public"]["Enums"]["newborn_sex"] | null
          status?: Database["public"]["Enums"]["newborn_status"]
          talla_cm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newborn_records_mother_admission_id_fkey"
            columns: ["mother_admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newborn_records_mother_patient_id_fkey"
            columns: ["mother_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newborn_records_pediatric_admission_id_fkey"
            columns: ["pediatric_admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newborn_records_pediatric_patient_id_fkey"
            columns: ["pediatric_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          payload: Json | null
          read_at: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_service: Database["public"]["Enums"]["service_type"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json | null
          read_at?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_service?: Database["public"]["Enums"]["service_type"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          read_at?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_service?: Database["public"]["Enums"]["service_type"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operative_notes: {
        Row: {
          admission_id: string
          anestesiologo: string | null
          circulante: string | null
          cirujano: string | null
          created_at: string
          created_by: string
          descripcion: string
          diagnostico_postoperatorio: string | null
          diagnosticos_preoperatorios: string | null
          hallazgos: string | null
          id: string
          instrumentista: string | null
          monitor_anestesiologo: string | null
          monitor_cirujano: string | null
          primer_ayudante: string | null
          rn_peso: number | null
          rn_talla: number | null
          segundo_ayudante: string | null
          surgery_at: string
          tercer_ayudante: string | null
        }
        Insert: {
          admission_id: string
          anestesiologo?: string | null
          circulante?: string | null
          cirujano?: string | null
          created_at?: string
          created_by: string
          descripcion: string
          diagnostico_postoperatorio?: string | null
          diagnosticos_preoperatorios?: string | null
          hallazgos?: string | null
          id?: string
          instrumentista?: string | null
          monitor_anestesiologo?: string | null
          monitor_cirujano?: string | null
          primer_ayudante?: string | null
          rn_peso?: number | null
          rn_talla?: number | null
          segundo_ayudante?: string | null
          surgery_at: string
          tercer_ayudante?: string | null
        }
        Update: {
          admission_id?: string
          anestesiologo?: string | null
          circulante?: string | null
          cirujano?: string | null
          created_at?: string
          created_by?: string
          descripcion?: string
          diagnostico_postoperatorio?: string | null
          diagnosticos_preoperatorios?: string | null
          hallazgos?: string | null
          id?: string
          instrumentista?: string | null
          monitor_anestesiologo?: string | null
          monitor_cirujano?: string | null
          primer_ayudante?: string | null
          rn_peso?: number | null
          rn_talla?: number | null
          segundo_ayudante?: string | null
          surgery_at?: string
          tercer_ayudante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operative_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_administrations: {
        Row: {
          administered_at: string | null
          administered_by: string | null
          created_at: string
          id: string
          item_index: number
          notes: string | null
          order_id: string
          scheduled_at: string
        }
        Insert: {
          administered_at?: string | null
          administered_by?: string | null
          created_at?: string
          id?: string
          item_index: number
          notes?: string | null
          order_id: string
          scheduled_at: string
        }
        Update: {
          administered_at?: string | null
          administered_by?: string | null
          created_at?: string
          id?: string
          item_index?: number
          notes?: string | null
          order_id?: string
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_administrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_transfers: {
        Row: {
          changed_at: string
          changed_by: string
          from_bed: string | null
          from_location: Database["public"]["Enums"]["location_type"] | null
          id: string
          patient_id: string
          to_bed: string | null
          to_location: Database["public"]["Enums"]["location_type"]
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_bed?: string | null
          from_location?: Database["public"]["Enums"]["location_type"] | null
          id?: string
          patient_id: string
          to_bed?: string | null
          to_location: Database["public"]["Enums"]["location_type"]
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_bed?: string | null
          from_location?: Database["public"]["Enums"]["location_type"] | null
          id?: string
          patient_id?: string
          to_bed?: string | null
          to_location?: Database["public"]["Enums"]["location_type"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_transfers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          apellidos: string
          cedula_number: string
          cedula_type: Database["public"]["Enums"]["cedula_type"]
          created_at: string
          created_by: string
          current_bed: string | null
          current_location: Database["public"]["Enums"]["location_type"]
          direccion: string | null
          fecha_nacimiento: string
          id: string
          nombres: string
          service: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["patient_status"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellidos: string
          cedula_number: string
          cedula_type: Database["public"]["Enums"]["cedula_type"]
          created_at?: string
          created_by: string
          current_bed?: string | null
          current_location?: Database["public"]["Enums"]["location_type"]
          direccion?: string | null
          fecha_nacimiento: string
          id?: string
          nombres: string
          service: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["patient_status"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellidos?: string
          cedula_number?: string
          cedula_type?: Database["public"]["Enums"]["cedula_type"]
          created_at?: string
          created_by?: string
          current_bed?: string | null
          current_location?: Database["public"]["Enums"]["location_type"]
          direccion?: string | null
          fecha_nacimiento?: string
          id?: string
          nombres?: string
          service?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["patient_status"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          cedula: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          cedula?: string | null
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          cedula?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      record_locks: {
        Row: {
          expires_at: string
          id: string
          locked_at: string
          locked_by: string
          record_id: string
          record_type: string
        }
        Insert: {
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by: string
          record_id: string
          record_type: string
        }
        Update: {
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by?: string
          record_id?: string
          record_type?: string
        }
        Relationships: []
      }
      temporary_access_tokens: {
        Row: {
          access_count: number
          admission_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          note: string | null
          patient_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          access_count?: number
          admission_id?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          note?: string | null
          patient_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          access_count?: number
          admission_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          note?: string | null
          patient_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_access_tokens_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_access_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          service: Database["public"]["Enums"]["service_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          service?: Database["public"]["Enums"]["service_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          service?: Database["public"]["Enums"]["service_type"] | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_review_records: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_locks: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_service_access: {
        Args: {
          _service: Database["public"]["Enums"]["service_type"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_medical_staff: { Args: { _user_id: string }; Returns: boolean }
      is_nurse: { Args: { _user_id: string }; Returns: boolean }
      is_obstetric_staff: { Args: { _user_id: string }; Returns: boolean }
      is_pediatric_staff: { Args: { _user_id: string }; Returns: boolean }
      is_superuser: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "especialista"
        | "r3"
        | "r2"
        | "r1"
        | "enfermeria"
        | "traslado"
      cedula_type: "V" | "E"
      discharge_type: "alta_medica" | "contraopinion"
      location_type: "consulta_externa" | "emergencia" | "hospitalizacion"
      newborn_sex: "masculino" | "femenino" | "indeterminado"
      newborn_status:
        | "en_sala_partos"
        | "cerrado_enfermeria"
        | "ingresado_neonato"
        | "constancia_historica"
      note_type: "medica" | "aclaratoria" | "enfermeria"
      patient_status: "activa" | "archivada"
      record_status: "pendiente_revision" | "confirmado"
      respiratory_effort: "espontaneo" | "estimulacion"
      service_type:
        | "obstetricia"
        | "pediatria"
        | "cirugia_general"
        | "cirugia_pediatrica"
        | "traumatologia"
        | "anestesiologia"
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
      app_role: [
        "admin",
        "especialista",
        "r3",
        "r2",
        "r1",
        "enfermeria",
        "traslado",
      ],
      cedula_type: ["V", "E"],
      discharge_type: ["alta_medica", "contraopinion"],
      location_type: ["consulta_externa", "emergencia", "hospitalizacion"],
      newborn_sex: ["masculino", "femenino", "indeterminado"],
      newborn_status: [
        "en_sala_partos",
        "cerrado_enfermeria",
        "ingresado_neonato",
        "constancia_historica",
      ],
      note_type: ["medica", "aclaratoria", "enfermeria"],
      patient_status: ["activa", "archivada"],
      record_status: ["pendiente_revision", "confirmado"],
      respiratory_effort: ["espontaneo", "estimulacion"],
      service_type: [
        "obstetricia",
        "pediatria",
        "cirugia_general",
        "cirugia_pediatrica",
        "traumatologia",
        "anestesiologia",
      ],
    },
  },
} as const
