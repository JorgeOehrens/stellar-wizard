import { NextRequest, NextResponse } from 'next/server';
import { calculateProjections, ProjectionInput, ProjectionResult } from '@/lib/vault-analysis';

export interface ProjectionRequest {
  principal: number;
  apy: number;
  timeHorizons?: number[]; // defaults to [6, 12, 18, 24]
  monthlyContribution?: number;
  compoundingFrequency?: 'monthly' | 'quarterly' | 'annually'; // defaults to monthly
}

export interface ProjectionResponse {
  projections: ProjectionResult[];
  assumptions: {
    compounding: string;
    apyType: string;
    fees: string;
  };
  summary: {
    totalInvested: number;
    finalBalance: number;
    totalReturns: number;
    effectiveApy: number;
  };
}

/**
 * POST /api/defindex/project
 * Calculate investment projections with compounding
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProjectionRequest = await request.json();

    // Validate required fields
    if (!body.principal || !body.apy) {
      return NextResponse.json(
        { error: 'Missing required fields: principal, apy' },
        { status: 400 }
      );
    }

    // Validate ranges
    if (body.principal <= 0) {
      return NextResponse.json(
        { error: 'Principal must be greater than 0' },
        { status: 400 }
      );
    }

    if (body.apy < 0 || body.apy > 1000) {
      return NextResponse.json(
        { error: 'APY must be between 0 and 1000%' },
        { status: 400 }
      );
    }

    const timeHorizons = body.timeHorizons || [6, 12, 18, 24];
    const monthlyContribution = body.monthlyContribution || 0;
    const compoundingFrequency = body.compoundingFrequency || 'monthly';

    // Calculate projections for the maximum time horizon
    const maxHorizon = Math.max(...timeHorizons);
    const projectionInput: ProjectionInput = {
      principal: body.principal,
      apy: body.apy,
      months: maxHorizon,
      monthlyContribution
    };

    const allProjections = calculateProjections(projectionInput);

    // Filter to requested time horizons
    const filteredProjections = allProjections.filter(p =>
      timeHorizons.includes(p.months)
    );

    // Calculate summary for final projection
    const finalProjection = filteredProjections[filteredProjections.length - 1];
    const effectiveApy = finalProjection
      ? (Math.pow(finalProjection.balance / body.principal, 12 / finalProjection.months) - 1) * 100
      : 0;

    const response: ProjectionResponse = {
      projections: filteredProjections,
      assumptions: {
        compounding: getCompoundingDescription(compoundingFrequency),
        apyType: 'Estimated APY based on vault risk profile and historical performance',
        fees: 'Projections are gross of protocol fees and gas costs'
      },
      summary: {
        totalInvested: finalProjection?.totalContributions || body.principal,
        finalBalance: finalProjection?.balance || body.principal,
        totalReturns: finalProjection?.totalReturns || 0,
        effectiveApy: Number(effectiveApy.toFixed(2))
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error calculating projections:', error);
    return NextResponse.json(
      { error: 'Failed to calculate projections' },
      { status: 500 }
    );
  }
}

function getCompoundingDescription(frequency: string): string {
  switch (frequency) {
    case 'monthly':
      return 'Monthly compounding (r_m = (1 + APY)^(1/12) - 1)';
    case 'quarterly':
      return 'Quarterly compounding (r_q = (1 + APY)^(1/4) - 1)';
    case 'annually':
      return 'Annual compounding (r_a = APY)';
    default:
      return 'Monthly compounding (default)';
  }
}

/**
 * GET /api/defindex/project
 * Get default projection scenarios for quick reference
 */
export async function GET(request: NextRequest) {
  try {
    const scenarios = [
      {
        name: 'Conservative',
        description: 'Stable yield with low risk',
        apy: 6,
        riskLevel: 'Low',
        example: calculateProjections({
          principal: 1000,
          apy: 6,
          months: 24
        })
      },
      {
        name: 'Balanced',
        description: 'Moderate risk with balanced returns',
        apy: 12,
        riskLevel: 'Medium',
        example: calculateProjections({
          principal: 1000,
          apy: 12,
          months: 24
        })
      },
      {
        name: 'Aggressive',
        description: 'Higher risk with potential for higher returns',
        apy: 20,
        riskLevel: 'High',
        example: calculateProjections({
          principal: 1000,
          apy: 20,
          months: 24
        })
      }
    ];

    return NextResponse.json({ scenarios });

  } catch (error) {
    console.error('Error getting projection scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to get scenarios' },
      { status: 500 }
    );
  }
}