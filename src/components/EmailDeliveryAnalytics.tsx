import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  EnvelopeOpen, 
  EnvelopeSimple, 
  CursorClick, 
  ChartBar, 
  DeviceMobile, 
  Desktop, 
  TrendUp,
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  Link as LinkIcon,
  CalendarBlank,
  UserCircle,
  Devices,
  Sparkle,
  X
} from '@phosphor-icons/react';
import { EmailDeliveryLog, EmailAnalytics, Employee } from '@/lib/types';
import { subDays } from 'date-fns';
import { dataBreve, dataOra } from '@/lib/tempoRelativo';

/** La data in forma ISO (2026-09-23): serve a raggruppare, non a mostrare. */
function giornoIso(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`;
}
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EmailDeliveryAnalyticsProps {
  currentUserId?: string;
  employees?: Employee[];
}

const COLORS = ['oklch(0.45 0.12 210)', 'oklch(0.68 0.18 35)', 'oklch(0.55 0.22 25)', 'oklch(0.50 0.02 230)', 'oklch(0.35 0.08 230)'];

export function EmailDeliveryAnalytics({ currentUserId, employees }: EmailDeliveryAnalyticsProps) {
  const { t, lingua } = useTranslation();
  /**
   * I log arrivano dalla tabella reale `email_delivery_logs`, scritta da
   * api/email/send.ts a ogni invio.
   *
   * Prima questo pannello leggeva la chiave useKV 'email-delivery-logs', che
   * nessuno scriveva: src/lib/emailTracking.ts salvava su window.spark.kv
   * (endpoint inesistente) e il server scriveva sulla tabella, che nessuno
   * leggeva. Tre archivi, nessuno collegato all'altro: il pannello era
   * sempre vuoto, e l'unico modo di riempirlo era il pulsante "Generate Demo
   * Data", cioe' numeri inventati dentro un cruscotto di analisi. Rimosso.
   *
   * Aperture e clic non sono misurati da nessuna parte: non esiste un
   * endpoint di tracciamento. I relativi campi restano quindi a zero e sono
   * dichiarati come non disponibili, invece di essere presentati come
   * misurazioni reali.
   */
  const { organization } = useAuth();
  const [deliveryLogs, setDeliveryLogs] = useState<EmailDeliveryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    if (!open || !organization?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_delivery_logs')
        .select('id, user_id, recipient_email, subject, provider, status, error, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (cancelled) return;
      setLoading(false);

      if (error) {
        // La policy "admins can read email logs" limita la lettura agli
        // amministratori: per gli altri non e' un guasto, e' il permesso.
        toast.error(`Log non leggibili: ${error.message}`);
        return;
      }

      const nomiPerId = new Map((employees ?? []).map((e) => [e.id, e.name]));

      setDeliveryLogs(
        (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          userName: nomiPerId.get(row.user_id) ?? row.recipient_email ?? 'Utente',
          userEmail: row.recipient_email ?? undefined,
          // La tabella non registra il tipo di email: si mostra il provider,
          // che invece c'e', invece di inventare una categoria.
          emailType: (row.provider ?? 'sconosciuto') as EmailDeliveryLog['emailType'],
          subject: row.subject,
          sentAt: row.created_at,
          status: row.status as EmailDeliveryLog['status'],
          error: row.error ?? undefined,
          openCount: 0,
          clicks: [],
        }))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organization?.id, employees]);

  const filteredLogs = useMemo(() => {
    let logs = deliveryLogs || [];

    if (selectedTimeRange !== 'all') {
      const days = parseInt(selectedTimeRange);
      const cutoffDate = subDays(new Date(), days);
      logs = logs.filter(log => new Date(log.sentAt) >= cutoffDate);
    }

    if (selectedType !== 'all') {
      logs = logs.filter(log => log.emailType === selectedType);
    }

    return logs;
  }, [deliveryLogs, selectedTimeRange, selectedType]);

  const analytics = useMemo((): EmailAnalytics => {
    const logs = filteredLogs;
    const totalSent = logs.filter(log => log.status === 'sent').length;
    const totalOpened = logs.filter(log => log.openedAt).length;
    const totalClicked = logs.filter(log => log.clicks.length > 0).length;
    const totalBounced = logs.filter(log => log.status === 'bounced').length;

    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const clickToOpenRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
    const bounceRate = logs.length > 0 ? (totalBounced / logs.length) * 100 : 0;

    const byType: EmailAnalytics['byType'] = {};
    const typeGroups = logs.reduce((acc, log) => {
      const type = log.emailType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(log);
      return acc;
    }, {} as Record<string, EmailDeliveryLog[]>);

    Object.entries(typeGroups).forEach(([type, typeLogs]) => {
      const sent = typeLogs.filter(log => log.status === 'sent').length;
      const opened = typeLogs.filter(log => log.openedAt).length;
      const clicked = typeLogs.filter(log => log.clicks.length > 0).length;
      byType[type] = {
        sent,
        opened,
        clicked,
        openRate: sent > 0 ? (opened / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      };
    });

    const byDevice = {
      desktop: logs.filter(log => log.deviceType === 'desktop').length,
      mobile: logs.filter(log => log.deviceType === 'mobile').length,
      tablet: logs.filter(log => log.deviceType === 'tablet').length,
      unknown: logs.filter(log => !log.deviceType || log.deviceType === 'unknown').length,
    };

    const linkClicks = logs.flatMap(log => log.clicks);
    const linkMap = linkClicks.reduce((acc, click) => {
      if (!acc[click.url]) {
        acc[click.url] = { clicks: 0, uniqueUsers: new Set<string>() };
      }
      acc[click.url].clicks++;
      return acc;
    }, {} as Record<string, { clicks: number; uniqueUsers: Set<string> }>);

    const topLinks = Object.entries(linkMap)
      .map(([url, data]) => ({
        url,
        clicks: data.clicks,
        uniqueClicks: data.uniqueUsers.size,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const recentDeliveries = [...logs]
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, 20);

    return {
      totalSent,
      totalOpened,
      totalClicked,
      openRate,
      clickRate,
      clickToOpenRate,
      bounceRate,
      byType,
      byDevice,
      topLinks,
      recentDeliveries,
    };
  }, [filteredLogs]);

  const timeSeriesData = useMemo(() => {
    const days = selectedTimeRange === 'all' ? 30 : parseInt(selectedTimeRange);
    const data: Array<{ date: string; sent: number; opened: number; clicked: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);

      /*
        Il raggruppamento passa dal giorno in forma ISO, non dall'etichetta
        mostrata: quest'ultima ora e' tradotta, e confrontare stringhe
        tradotte per capire se due invii cadono nello stesso giorno significa
        far dipendere un conteggio dalla lingua dell'interfaccia.
      */
      const giorno = giornoIso(date);
      const dateStr = dataBreve(date, lingua);
      const dayLogs = filteredLogs.filter(log => giornoIso(new Date(log.sentAt)) === giorno);

      data.push({
        date: dateStr,
        sent: dayLogs.filter(log => log.status === 'sent').length,
        opened: dayLogs.filter(log => log.openedAt).length,
        clicked: dayLogs.filter(log => log.clicks.length > 0).length,
      });
    }

    return data;
  }, [filteredLogs, selectedTimeRange, lingua]);

  const typeDistributionData = useMemo(() => {
    return Object.entries(analytics.byType).map(([type, data]) => ({
      name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: data.sent,
    }));
  }, [analytics.byType]);

  const deviceDistributionData = useMemo(() => {
    return [
      { name: t('Desktop'), value: analytics.byDevice.desktop },
      { name: t('Mobile'), value: analytics.byDevice.mobile },
      { name: t('Tablet'), value: analytics.byDevice.tablet },
      { name: t('Unknown'), value: analytics.byDevice.unknown },
    ].filter(item => item.value > 0);
  }, [analytics.byDevice, t]);

  const performanceByTypeData = useMemo(() => {
    return Object.entries(analytics.byType).map(([type, data]) => ({
      type: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      openRate: data.openRate,
      clickRate: data.clickRate,
    }));
  }, [analytics.byType]);

  const emailTypes = useMemo(() => {
    const types = new Set<string>();
    (deliveryLogs || []).forEach(log => types.add(log.emailType));
    return Array.from(types);
  }, [deliveryLogs]);

  const getStatusIcon = (status: EmailDeliveryLog['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" weight="fill" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-destructive" weight="fill" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" weight="fill" />;
      default:
        return null;
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'desktop':
        return <Desktop className="h-4 w-4" />;
      case 'mobile':
      case 'tablet':
        return <DeviceMobile className="h-4 w-4" />;
      default:
        return <Devices className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ChartBar className="mr-2 h-5 w-5" weight="duotone" />{t('Email Analytics')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ChartBar className="h-6 w-6" weight="duotone" />{t('Email Delivery Analytics')}</DialogTitle>
              <DialogDescription>
                Esiti di consegna reali registrati dal server. Aperture e clic
                non sono tracciati: quei valori restano a zero.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {loading && (
                <span className="text-muted-foreground self-center text-sm">
                  Caricamento…
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-3 mb-4">
          <Select value={selectedTimeRange} onValueChange={(value: any) => setSelectedTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('Last 7 days')}</SelectItem>
              <SelectItem value="30d">{t('Last 30 days')}</SelectItem>
              <SelectItem value="90d">{t('Last 90 days')}</SelectItem>
              <SelectItem value="all">{t('All time')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('All types')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All types')}</SelectItem>
              {emailTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          {/*
            In tedesco "Delivery Logs" diventa "Zustellungsprotokolle": in una
            colonna da ~85px il testo non andava a capo (whitespace-nowrap) e
            sfondava sulla scheda accanto. Vedi lo stesso schema in App.tsx.
          */}
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
            <TabsTrigger value="performance">{t('Performance')}</TabsTrigger>
            <TabsTrigger value="engagement">{t('Engagement')}</TabsTrigger>
            <TabsTrigger value="logs">{t('Delivery Logs')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('Total Sent')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <EnvelopeSimple className="h-5 w-5 text-primary" weight="fill" />
                    <div className="text-2xl font-bold">{analytics.totalSent}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('Open Rate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <EnvelopeOpen className="h-5 w-5 text-green-600" weight="fill" />
                    <div className="text-2xl font-bold">{analytics.openRate.toFixed(1)}%</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('{count} opened', { count: analytics.totalOpened })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('Click Rate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CursorClick className="h-5 w-5 text-accent" weight="fill" />
                    <div className="text-2xl font-bold">{analytics.clickRate.toFixed(1)}%</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('{count} clicked', { count: analytics.totalClicked })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('Bounce Rate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Warning className="h-5 w-5 text-destructive" weight="fill" />
                    <div className="text-2xl font-bold">{analytics.bounceRate.toFixed(1)}%</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('{count} bounced', { count: filteredLogs.filter(l => l.status === 'bounced').length })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('Email Activity Over Time')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sent" stroke="oklch(0.45 0.12 210)" name="Sent" />
                    <Line type="monotone" dataKey="opened" stroke="oklch(0.35 0.88 145)" name="Opened" />
                    <Line type="monotone" dataKey="clicked" stroke="oklch(0.68 0.18 35)" name="Clicked" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('Email Types Distribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {typeDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={typeDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {typeDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">{t('No data available')}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('Device Distribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {deviceDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={deviceDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {deviceDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">{t('No data available')}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('Performance by Email Type')}</CardTitle>
                <CardDescription>{t('Open and click rates for different email types')}</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceByTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={performanceByTypeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="openRate" fill="oklch(0.35 0.88 145)" name="Open Rate %" />
                      <Bar dataKey="clickRate" fill="oklch(0.68 0.18 35)" name="Click Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">{t('No data available')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('Detailed Performance Metrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.byType).map(([type, data]) => (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <Badge variant="secondary">{t('{count} sent', { count: data.sent })}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t('Open Rate')}</span>
                            <span className="font-medium">{data.openRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={data.openRate} className="h-2" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t('Click Rate')}</span>
                            <span className="font-medium">{data.clickRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={data.clickRate} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('Top Clicked Links')}</CardTitle>
                <CardDescription>{t('Most popular links in your emails')}</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topLinks.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analytics.topLinks.map((link, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{link.url}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{t('Total clicks: {count}', { count: link.clicks })}</span>
                              <span>{t('Unique: {count}', { count: link.uniqueClicks })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CursorClick className="h-5 w-5 text-accent" weight="fill" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">{t('No click data available')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('Engagement Metrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendUp className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('Click-to-Open Rate')}</span>
                    </div>
                    <div className="text-3xl font-bold mb-2">{analytics.clickToOpenRate.toFixed(1)}%</div>
                    <Progress value={analytics.clickToOpenRate} className="h-2 mb-2" />
                    <p className="text-sm text-muted-foreground">{t('Percentage of opened emails that received clicks')}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarBlank className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('Average Engagement')}</span>
                    </div>
                    <div className="text-3xl font-bold mb-2">
                      {((analytics.openRate + analytics.clickRate) / 2).toFixed(1)}%
                    </div>
                    <Progress value={(analytics.openRate + analytics.clickRate) / 2} className="h-2 mb-2" />
                    <p className="text-sm text-muted-foreground">{t('Combined open and click rate average')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('Recent Deliveries')}</CardTitle>
                <CardDescription>{t('Latest email delivery activity')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Status')}</TableHead>
                        <TableHead>{t('Recipient')}</TableHead>
                        <TableHead>{t('Type')}</TableHead>
                        <TableHead>{t('Subject')}</TableHead>
                        <TableHead>{t('Sent')}</TableHead>
                        <TableHead>{t('Opened')}</TableHead>
                        <TableHead>{t('Clicks')}</TableHead>
                        <TableHead>{t('Device')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.recentDeliveries.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              <span className="text-xs capitalize">{log.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">{log.userName}</div>
                                {log.userEmail && (
                                  <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.emailType.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {dataOra(log.sentAt, lingua)}
                          </TableCell>
                          <TableCell>
                            {log.openedAt ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" weight="fill" />
                                <span className="text-xs">{log.openCount}x</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.clicks.length > 0 ? (
                              <div className="flex items-center gap-1 text-accent">
                                <CursorClick className="h-4 w-4" weight="fill" />
                                <span className="text-xs">{log.clicks.length}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {getDeviceIcon(log.deviceType)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
