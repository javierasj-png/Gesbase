import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Train, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupNombre, setSignupNombre] = useState('');
  const [signupApellidos, setSignupApellidos] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail.trim(), loginPassword);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: error.message === 'Invalid login credentials' 
          ? 'Email o contraseña incorrectos (si es tu primera vez, usa "Registrarse")'
          : error.message,
      });
    } else {
      toast({
        title: 'Bienvenido',
        description: 'Acceso correcto al sistema',
      });
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signUp(signupEmail.trim(), signupPassword, signupNombre, signupApellidos);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: error.message,
      });
    } else {
      toast({
        title: 'Cuenta creada',
        description: 'Tu cuenta ha sido creada. Un administrador debe activarla antes de que puedas acceder.',
      });
      // Don't navigate - user needs to be activated first
    }
    
    setIsLoading(false);
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

        {/* Login/Signup Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Acceso al Sistema</CardTitle>
            <CardDescription>Introduce tus credenciales</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Accediendo...
                      </>
                    ) : (
                      'Acceder'
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-nombre">Nombre</Label>
                      <Input
                        id="signup-nombre"
                        type="text"
                        placeholder="Juan"
                        value={signupNombre}
                        onChange={(e) => setSignupNombre(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-apellidos">Apellidos</Label>
                      <Input
                        id="signup-apellidos"
                        type="text"
                        placeholder="García"
                        value={signupApellidos}
                        onChange={(e) => setSignupApellidos(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      'Crear cuenta'
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Después del registro, un administrador asignará tu rol y bases
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
