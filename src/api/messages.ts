import apiClient from './client';
import { Message } from '../types';

export async function getMessages(): Promise<Message[]> {
  const { data } = await apiClient.get('/messages');
  return data.data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get('/messages/unread-count');
  return data.data.unreadCount;
}

export interface SendMessagePayload {
  recipientId: number;
  subject: string;
  body: string;
}

export async function sendMessage(payload: SendMessagePayload): Promise<Message> {
  const { data } = await apiClient.post('/messages', payload);
  return data.data;
}

export async function markMessageAsRead(id: number): Promise<Message> {
  const { data } = await apiClient.patch(`/messages/${id}/read`);
  return data.data;
}

export interface HrRecipient {
  recipientId: number;
  recipientName: string;
}

export async function getHrRecipient(): Promise<HrRecipient> {
  const { data } = await apiClient.get('/messages/hr');
  return data.data;
}
