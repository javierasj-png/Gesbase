import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, ClipboardList, CheckCircle2, Percent } from 'lucide-react';
import { usePlanesVigilancia } from '@/hooks/usePlanesVigilancia';

interface Props {
  baseFilter?: string;
}

export function PlanesEspecificosResumen({ baseFilter }: Props) {
  const navigate = useNavigate();
  const { planes } = usePlanesVigilancia();

  const stats = useMemo(() => {
    const list = planes.filter(
      (p) =>
        p.estado !== 'archivado' &&
        (!baseFilter || baseFilter === 'todas' || p.base === baseFilter)
    );
    const propuesta = list.filter((p) => p.estado === 'propuesta').length;
    const validados = list.filter((p) => p.estado === 'validado').length;
    const total = list.reduce((s, p) => s + p.totalAcciones, 0);
    const hechas = list.reduce((s, p) => s + p.accionesRealizadas, 0);
    return {
      activos: list.length,
      propuesta,
      validados,
      progreso: total ? Math.round((hechas / total) * 100) : 0,
      hechas,
      total,
    };
  }, [planes, baseFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Planes Específicos de Vigilancia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/planes-vigilancia')}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Planes Activos</span>
            </div>
            <p className="text-2xl font-bold">{stats.activos}</p>
          </div>
          <div
            className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/planes-vigilancia')}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-status-proximo" />
              <span className="text-sm text-muted-foreground">En Propuesta</span>
            </div>
            <p className={`text-2xl font-bold ${stats.propuesta > 0 ? 'text-status-proximo' : ''}`}>
              {stats.propuesta}
            </p>
          </div>
          <div
            className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/planes-vigilancia')}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-status-ok" />
              <span className="text-sm text-muted-foreground">Validados</span>
            </div>
            <p className="text-2xl font-bold">{stats.validados}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50" title="Acciones realizadas / total planificadas">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Avance Acciones</span>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">{stats.progreso}%</p>
              <Progress value={stats.progreso} className="flex-1 h-2" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats.hechas} / {stats.total} acciones
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
