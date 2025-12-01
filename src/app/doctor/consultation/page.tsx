'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DoctorConsultationPage() {
    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">진료실</h1>
            <Card>
                <CardHeader>
                    <CardTitle>대기 환자 목록</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">대기 중인 환자가 없습니다.</p>
                </CardContent>
            </Card>
        </div>
    );
}
