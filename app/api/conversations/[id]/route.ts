import { NextRequest, NextResponse } from 'next/server'
import { conversationStore } from '@/lib/storage'
import { ConversationMutation } from '@/types'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const conversation = await conversationStore.get(id)

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  return NextResponse.json(conversation)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as ConversationMutation
  const conversation = await conversationStore.patch(id, body)

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  return NextResponse.json(conversation)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await conversationStore.delete(id)
  return NextResponse.json({ ok: true })
}
