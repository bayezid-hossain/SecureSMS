import { useAppStore } from '../store/useAppStore'
import { AppAlertProps } from '../components/AppAlert'

export function useAlert() {
  const showAlert = useAppStore((s) => s.showAlert)
  const hideAlert = useAppStore((s) => s.hideAlert)

  const alert = (title: string, message?: string, buttons?: AppAlertProps['buttons'], icon?: string) => {
    showAlert({
      title,
      message,
      buttons: buttons?.map(b => ({
        ...b,
        onPress: () => {
          hideAlert()
          b.onPress?.()
        }
      })) ?? [{ text: 'OK', onPress: hideAlert }],
      icon,
      onClose: hideAlert,
    })
  }

  return { alert, hideAlert }
}
