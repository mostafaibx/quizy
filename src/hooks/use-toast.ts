import { toast } from "sonner";

export function useToast() {
  return {
    toast: (props: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive";
      duration?: number;
    }) => {
      if (props.variant === "destructive") {
        toast.error(props.title || props.description);
      } else {
        toast.success(props.title || props.description);
      }
    },
  };
}