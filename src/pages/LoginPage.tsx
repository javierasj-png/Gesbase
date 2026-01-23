import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Rol } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Train, Shield, Users } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [selectedRol, setSelectedRol] = useState<Rol | null>(null);

  const handleLogin = () => {
    if (selectedRol) {
      login(selectedRol);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Train className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Base</h1>
          <p className="text-muted-foreground mt-1">Sistema de Vigilancia y Trazabilidad</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Renfe Viajeros</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Acceso al Sistema</CardTitle>
            <CardDescription>Seleccione su perfil para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedRol('Mando')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedRol === 'Mando'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <Users className={`w-8 h-8 mx-auto mb-2 ${selectedRol === 'Mando' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`text-sm font-medium ${selectedRol === 'Mando' ? 'text-primary' : 'text-foreground'}`}>
                  Mando
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gestión de evidencias
                </p>
              </button>

              <button
                onClick={() => setSelectedRol('Admin')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedRol === 'Admin'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <Shield className={`w-8 h-8 mx-auto mb-2 ${selectedRol === 'Admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`text-sm font-medium ${selectedRol === 'Admin' ? 'text-primary' : 'text-foreground'}`}>
                  Administrador
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configuración del sistema
                </p>
              </button>
            </div>

            {/* Login Button */}
            <Button 
              className="w-full mt-4" 
              size="lg"
              disabled={!selectedRol}
              onClick={handleLogin}
            >
              Acceder
            </Button>

            {/* Info */}
            <p className="text-xs text-center text-muted-foreground mt-4">
              Prototipo de demostración • Datos simulados
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
