import {
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Briefcase,
  Calendar,
  Code2,
  Server,
  Layers,
  Cpu,
} from 'lucide-react';
import { APP_NAME } from '@/config/constants';

export function Settings() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex flex-col pt-12 pb-8 px-6 text-foreground">
      
      {/* Header Container */}
      <div className="max-w-4xl w-full mx-auto mb-10 text-center space-y-3">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Developer Profile
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Learn more about the creator and connect to discuss technology, collaboration, and enterprise solutions.
        </p>
      </div>

      <div className="max-w-4xl w-full mx-auto">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Side: Photo & Quick Info */}
          <div className="md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-secondary/50 p-8 flex flex-col items-center justify-center text-center">
            
            <div className="w-48 h-48 rounded-full border-4 border-card shadow-md overflow-hidden mb-6 bg-muted">
              <img
                src="/creator-profile.png"
                alt="Nilesh Pardeshi"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div className="w-full h-full hidden items-center justify-center bg-secondary">
                <span className="text-5xl font-bold text-muted-foreground">NP</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              Nilesh Pardeshi
            </h2>
            
            <div className="flex items-center gap-1.5 text-sm text-aqua-600 dark:text-aqua-500 font-medium mb-1">
              <Briefcase className="w-4 h-4" /> Technical Manager
            </div>
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
              <MapPin className="w-4 h-4" /> Opus Technologies
            </div>

            <div className="w-full h-px bg-border my-2" />

            <div className="w-full pt-4 space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-left mb-2">Connect</p>
              
              <a href="mailto:contactaquaai@gmail.com" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-aqua-600 dark:hover:text-aqua-400 transition-colors">
                <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate">contactaquaai@gmail.com</span>
              </a>
              
              <a href="tel:+919762017007" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-aqua-600 dark:hover:text-aqua-400 transition-colors">
                <Phone className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span>+91-9762017007</span>
              </a>
              
              <a href="https://www.linkedin.com/in/nileshpardeshi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-aqua-600 dark:hover:text-aqua-400 transition-colors">
                <Linkedin className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate">nileshpardeshi</span>
              </a>
            </div>

          </div>

          {/* Right Side: Bio & Stats */}
          <div className="flex-1 p-8 text-muted-foreground">
            <h3 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">
              Professional Biography
            </h3>
            
            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                Seasoned technology leader with <span className="font-semibold text-foreground">15+ years</span> of hands-on experience in enterprise software engineering, database architecture, and AI-driven product development. 
              </p>
              <p>
                Deep expertise spanning full-stack development, cloud-native architectures, large-scale data systems, and modern AI/ML integration. Proven track record of translating complex business requirements into robust technical solutions.
              </p>
              <p>
                Creator of <span className="font-semibold text-aqua-600 dark:text-aqua-400">{APP_NAME}</span> — an enterprise-grade AI-powered database engineering platform built specifically for complex, multi-dialect enterprise environments.
              </p>
            </div>

            <h3 className="text-lg font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border">
              Key Metrics
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Calendar, value: '15+', label: 'Years Experience' },
                { icon: Layers, value: '50+', label: 'Enterprise Projects' },
                { icon: Server, value: '7+', label: 'Database Dialects' },
                { icon: Cpu, value: 'AI Native', label: 'Architecture' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="p-2 bg-background rounded-md border border-border shrink-0">
                    <s.icon className="w-4 h-4 text-aqua-600 dark:text-aqua-500" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
        
        {/* Footer Note */}
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Code2 className="w-4 h-4" />
          <span>Crafted with care by Nilesh Pardeshi</span>
        </div>
        
      </div>
    </div>
  );
}

export default Settings;
