import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { format, parseISO } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    console.log('=== CSV Export Request ===');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('ERROR: No authorization header');
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.log('ERROR: Auth error:', authError.message);
      return NextResponse.json({ error: 'Unauthorized: ' + authError.message }, { status: 401 });
    }
    
    if (!user) {
      console.log('ERROR: No user found');
      return NextResponse.json({ error: 'Unauthorized: No user found' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    const { separator, fromDate, toDate, includes } = await request.json();

    console.log('CSV Export params:', { separator, fromDate, toDate, includes, userId: user.id });

    // Parse dates (format: DD.MM.YYYY)
    const [fromDay, fromMonth, fromYear] = fromDate.split('.');
    const [toDay, toMonth, toYear] = toDate.split('.');
    const startDate = `${fromYear}-${fromMonth.padStart(2, '0')}-${fromDay.padStart(2, '0')}`;
    const endDate = `${toYear}-${toMonth.padStart(2, '0')}-${toDay.padStart(2, '0')}`;

    console.log('Date range:', startDate, 'to', endDate);

    // Build query based on includes
    let query = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    // Filter by transaction type
    const types: string[] = [];
    if (includes?.income) types.push('income');
    if (includes?.expenses) types.push('expense');
    if (includes?.transfers) types.push('transfer');

    console.log('Transaction types to include:', types);

    if (types.length > 0 && types.length < 3) {
      query = query.in('type', types);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.log('ERROR: Failed to fetch transactions:', txError.message);
      throw new Error('Failed to fetch transactions: ' + txError.message);
    }

    console.log('✅ Fetched transactions:', transactions?.length || 0);

    // Generate CSV content with BOM for Excel compatibility
    const csvRows: string[] = [];
    
    // Header row
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
    csvRows.push(headers.join(separator));

    // Data rows
    (transactions || []).forEach(tx => {
      const row = [
        format(parseISO(tx.date), 'dd.MM.yyyy'),
        tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        tx.category || 'Uncategorized',
        Number(tx.amount).toFixed(2),
        (tx.description || '').replace(/"/g, '""') // Escape quotes
      ];
      
      // Wrap fields with separator in quotes
      const escapedRow = row.map(field => {
        const fieldStr = String(field);
        if (fieldStr.includes(separator) || fieldStr.includes('"') || fieldStr.includes('\n')) {
          return `"${fieldStr}"`;
        }
        return fieldStr;
      });
      
      csvRows.push(escapedRow.join(separator));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n'); // Add BOM for Excel

    console.log('✅ CSV generated, size:', csvContent.length, 'bytes');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transactions-${startDate}-to-${endDate}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('CSV Export Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
