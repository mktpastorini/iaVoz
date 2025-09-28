"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, UserPlus } from 'lucide-react';

import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select';

interface SaasUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  workspace_id: string;
}

const userSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido."),
  role: z.enum(['admin', 'member'], { required_error: "A função é obrigatória." }),
});

type UserFormData = z.infer<typeof userSchema>;

const SaasUsersPage: React.FC = () => {
  const { user: adminUser, role } = useSession();
  const [users, setUsers] = useState<SaasUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SaasUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SaasUser | null>(null);

  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const fetchUsers = useCallback(async () => {
    if (role !== 'admin') return; // Apenas admins podem buscar todos os usuários
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-all-saas-users');
      if (error) throw error;
      setUsers(data);
    } catch (error: any) {
      showError("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenForm = (user: SaasUser | null) => {
    setEditingUser(user);
    reset(user ? { email: user.email, role: user.role } : { email: '', role: 'member' });
    setIsFormOpen(true);
  };

  const onSubmit = async (formData: UserFormData) => {
    if (!editingUser) return; // Apenas edição de função é suportada aqui
    try {
      const { error } = await supabase.functions.invoke('update-user-role', {
        body: { user_id: editingUser.id, workspace_id: editingUser.workspace_id, role: formData.role },
      });
      if (error) throw error;
      showSuccess(`Função do usuário atualizada com sucesso!`);
      setIsFormOpen(false);
      fetchUsers();
    } catch (error: any) {
      showError(`Erro: ${error.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: deletingUser.id },
      });
      if (error) throw error;
      showSuccess("Usuário excluído com sucesso.");
      setDeletingUser(null);
      fetchUsers();
    } catch (error: any) {
      showError(`Erro ao excluir usuário: ${error.message}`);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: email },
      });
      if (error) throw error;
      showSuccess(`E-mail de redefinição de senha enviado para ${email}.`);
    } catch (error: any) {
      showError(`Erro ao enviar e-mail: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        {/* O botão de adicionar agora é o formulário de cadastro na página de login */}
      </div>

      <Card>
        <CardHeader><CardTitle>Todos os Usuários da Plataforma</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.first_name || user.email.split('@')[0]}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}>
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenForm(user)}>Editar Função</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendPasswordReset(user.email)}>Redefinir Senha</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingUser(user)}>Excluir Usuário</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center">Nenhum usuário encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Editar Função */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Função do Usuário</DialogTitle>
            <DialogDescription>
              Altere a função de <strong>{editingUser?.email}</strong> no workspace dele.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="role">Função</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-destructive text-sm mt-1">{errors.role.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta de Exclusão */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá remover permanentemente o usuário <strong>{deletingUser?.email}</strong> de todo o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Sim, excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SaasUsersPage;