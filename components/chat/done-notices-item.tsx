'use client'

import { useEffect, useState } from 'react'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { canShowNotices, readDoneNoticesSetting, writeDoneNoticesSetting } from '@/lib/pwa/done-notices'

type NoticeState = 'unsupported' | 'blocked' | 'off' | 'on'

function currentState(): NoticeState {
  if (!canShowNotices({ hasNotification: 'Notification' in window, userAgent: navigator.userAgent })) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && readDoneNoticesSetting() ? 'on' : 'off'
}

/** "Notify me when replies finish" in the account menu. Asks for permission on first use. */
export function DoneNoticesItem() {
  const [state, setState] = useState<NoticeState>('unsupported')

  useEffect(() => {
    setState(currentState())
  }, [])

  if (state === 'unsupported') return null
  if (state === 'blocked') {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        Reply notices are blocked for this site in your browser settings.
      </p>
    )
  }

  const toggle = async (checked: boolean) => {
    if (!checked) {
      writeDoneNoticesSetting(false)
      setState('off')
      return
    }
    const permission =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission === 'granted') {
      setState(writeDoneNoticesSetting(true) ? 'on' : 'off')
      return
    }
    setState(permission === 'denied' ? 'blocked' : 'off')
  }

  return (
    <DropdownMenuCheckboxItem
      checked={state === 'on'}
      onSelect={(event) => event.preventDefault()}
      onCheckedChange={(checked) => void toggle(checked === true)}
    >
      Notify me when replies finish
    </DropdownMenuCheckboxItem>
  )
}
