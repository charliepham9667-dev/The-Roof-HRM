import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { ResourceLink, ResourceCategory } from '../types';

// Get all resources
export function useResources(category?: ResourceCategory) {
  return useQuery({
    queryKey: ['resources', category],
    queryFn: async (): Promise<ResourceLink[]> => {
      let query = supabase
        .from('resource_links')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapResource);
    },
  });
}

// Get resources grouped by category
export function useResourcesByCategory() {
  const { data: resources } = useResources();

  const grouped = resources?.reduce((acc, resource) => {
    if (!acc[resource.category]) {
      acc[resource.category] = [];
    }
    acc[resource.category].push(resource);
    return acc;
  }, {} as Record<ResourceCategory, ResourceLink[]>) || {};

  return grouped;
}

// Create resource
export function useCreateResource() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: Partial<ResourceLink>) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('resource_links')
        .insert({
          title: input.title,
          title_vi: input.titleVi || null,
          description: input.description || null,
          description_vi: input.descriptionVi || null,
          url: input.url,
          category: input.category,
          subcategory: input.subcategory || null,
          icon: input.icon || 'file-text',
          sort_order: input.sortOrder || 0,
          is_active: true,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

// Update resource
export function useUpdateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ResourceLink> & { id: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.titleVi !== undefined) updateData.title_vi = input.titleVi;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;

      const { data, error } = await supabase
        .from('resource_links')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

// Delete resource
export function useDeleteResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('resource_links')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

// Helper mapper
function mapResource(row: any): ResourceLink {
  return {
    id: row.id,
    title: row.title,
    titleVi: row.title_vi,
    description: row.description,
    descriptionVi: row.description_vi,
    url: row.url,
    category: row.category as ResourceCategory,
    subcategory: row.subcategory,
    icon: row.icon,
    complianceItemId: row.compliance_item_id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
