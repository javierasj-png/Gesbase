import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, FileText, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Parte, TipoParte, EstadoParte, TipoInforme } from '@/types/partes';

interface PartesTableProps {
  partes: Parte[];
  onView: (parte: Parte) => void;
  onEdit?: (parte: Parte) => void;
  onDelete: (id: string) => void;
}

const tipoColors: Record<TipoParte, string> = {
  'Incidencia': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Retraso': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  'Avería': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Seguridad': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Otro': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const estadoColors: Record<EstadoParte, string> = {
  'Nuevo': 'bg-green-500/10 text-green-600 border-green-500/20',
  'En revisión': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  'Cerrado': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const informeColors: Record<TipoInforme, string> = {
  'PAI': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Informe Conducción': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

export function PartesTable({ partes, onView, onEdit, onDelete }: PartesTableProps) {
  if (partes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No hay partes registrados</p>
        <p className="text-xs">Sube un documento para comenzar</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[160px]">Tipo Informe</TableHead>
            <TableHead className="w-[100px]">Fecha</TableHead>
            <TableHead>Base</TableHead>
            <TableHead>Maquinista</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead className="w-[100px]">Estado</TableHead>
            <TableHead className="w-[80px]">Confianza</TableHead>
            <TableHead className="w-[100px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partes.map((parte) => (
            <TableRow key={parte.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                {parte.tipo_informe ? (
                  <Badge variant="outline" className={cn("text-xs", informeColors[parte.tipo_informe as TipoInforme])}>
                    {parte.tipo_informe}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell>
                {parte.fecha_parte 
                  ? format(new Date(parte.fecha_parte), 'dd/MM/yyyy', { locale: es })
                  : '-'}
              </TableCell>
              <TableCell>{parte.base || '-'}</TableCell>
              <TableCell>{parte.maquinista_texto || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-xs", tipoColors[parte.tipo_parte])}>
                  {parte.tipo_parte}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-xs", estadoColors[parte.estado])}>
                  {parte.estado}
                </Badge>
              </TableCell>
              <TableCell>
                <span className={cn(
                  "text-sm font-medium",
                  parte.confianza_global >= 80 ? "text-green-600" :
                  parte.confianza_global >= 50 ? "text-yellow-600" : "text-red-600"
                )}>
                  {parte.confianza_global}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => onView(parte)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {onEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => onEdit(parte)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(parte.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
