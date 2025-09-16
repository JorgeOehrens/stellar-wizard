'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { TrendingUp, RefreshCw } from 'lucide-react';

interface ProjectionResult {
  months: number;
  balance: number;
  totalContributions: number;
  totalReturns: number;
}

interface ProjectionSimulatorProps {
  initialAmount: number;
  initialApy: number;
  asset?: string;
  network?: string;
  onApyChange?: (newApy: number) => void;
}

const ProjectionSimulator: React.FC<ProjectionSimulatorProps> = ({
  initialAmount,
  initialApy,
  asset = 'USD',
  network = 'TESTNET',
  onApyChange
}) => {
  const [apy, setApy] = useState(initialApy);
  const [projections, setProjections] = useState<ProjectionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    calculateProjections();
  }, [initialAmount, apy]);

  const calculateProjections = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/defindex/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal: initialAmount,
          apy: apy,
          timeHorizons: [6, 12, 18, 24]
        })
      });

      const data = await response.json();
      setProjections(data.projections || []);
    } catch (error) {
      console.error('Error calculating projections:', error);
      // Fallback to client-side calculation
      const fallbackProjections = calculateFallbackProjections();
      setProjections(fallbackProjections);
    }

    setIsLoading(false);
  };

  const calculateFallbackProjections = (): ProjectionResult[] => {
    const monthlyRate = Math.pow(1 + apy / 100, 1 / 12) - 1;
    return [6, 12, 18, 24].map(months => {
      const balance = initialAmount * Math.pow(1 + monthlyRate, months);
      return {
        months,
        balance,
        totalContributions: initialAmount,
        totalReturns: balance - initialAmount
      };
    });
  };

  const handleApyChange = (newApy: number) => {
    if (newApy >= 0 && newApy <= 200) { // Reasonable bounds
      setApy(newApy);
      onApyChange?.(newApy);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Projected Balance ({network})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* APY Adjustment */}
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <div>
            <label className="text-sm font-medium">Initial Investment</label>
            <p className="text-lg font-bold">{initialAmount.toLocaleString()} {asset}</p>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Assumed APY</label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={apy}
                onChange={(e) => handleApyChange(parseFloat(e.target.value) || 0)}
                className="w-20"
                min="0"
                max="200"
                step="0.1"
              />
              <span className="text-sm">%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={calculateProjections}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Projections Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {projections.map((proj) => (
            <div key={proj.months} className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground font-medium">{proj.months} months</p>
              <p className="text-lg font-bold">
                {proj.balance.toFixed(2)} {asset}
              </p>
              <p className="text-xs text-green-600">
                +{proj.totalReturns.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Assumptions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 *Note:* Monthly compounding assumed. APY is estimated from vault analysis.</p>
          <p>⚠️ *Disclaimer:* Projections are estimates and not guaranteed. Actual returns may vary.</p>
        </div>

        {/* Performance Summary */}
        {projections.length > 0 && (
          <div className="flex justify-between items-center p-3 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">24-month return</p>
              <p className="font-semibold text-green-600">
                +{((projections[3]?.balance / initialAmount - 1) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total profit</p>
              <p className="font-semibold">
                +{projections[3]?.totalReturns.toFixed(2)} {asset}
              </p>
            </div>
            <Badge variant="outline">
              {apy.toFixed(1)}% APY
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectionSimulator;