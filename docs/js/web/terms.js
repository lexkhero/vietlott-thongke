/* Thống kê Vietlott - bảng giải thích thuật ngữ.
 * Mỗi mục: id (dùng trong data-term), nhóm, tên gọi trên giao diện, lời giải thích bằng lời thường (HTML) và ví dụ.
 * app.js dùng bảng này để mở khung giải thích khi bấm vào một từ có gạch chân chấm hoặc nút "?",
 * và để dựng mục "Giải thích thuật ngữ". Sửa lời ở đây thì mọi nơi trên giao diện đổi theo. */
window.VLTERMS = {
  groups: [
    ['ket-qua', 'Đọc kết quả và bảng số'],
    ['tien', 'Cơ hội trúng và tiền thưởng'],
    ['kiem-tra', 'Kiểm tra máy quay có ngẫu nhiên không'],
    ['chon-so', 'Cách chọn số và kiểm chứng'],
    ['ky-thuat', 'Số liệu kỹ thuật (chỉ hiện khi bật công tắc)']
  ],
  items: [
    /* ------------------------------------------------ đọc kết quả và bảng số */
    { id: 'ky', group: 'ket-qua', name: 'Kỳ quay',
      text: '<p>Mỗi lần Vietlott quay số là một kỳ, có số thứ tự riêng. Power 6/55 và Mega 6/45 quay 3 kỳ mỗi tuần lúc 18h. Lotto 5/35 quay 2 kỳ mỗi ngày, lúc 13h và 21h.</p>',
      ex: 'Kỳ #01002 là kỳ quay thứ 1.002 của loại vé đó.' },
    { id: 'pham-vi', group: 'ket-qua', name: 'Phạm vi thống kê',
      text: '<p>Ô chọn ở đầu trang quyết định các con số được tính trên những kỳ nào: toàn bộ các kỳ đã quay, hay chỉ 50, 100, 200, 500 kỳ gần nhất. Đổi phạm vi thì bảng số, bảng xếp hạng và các phép kiểm tra đều được tính lại.</p>',
      ex: 'Chọn "100 kỳ gần nhất" thì "ra 20 lần" nghĩa là ra 20 lần trong 100 kỳ đó.' },
    { id: 'trung-binh', group: 'ket-qua', name: 'Mức trung bình (lý thuyết)',
      text: '<p>Nếu máy quay công bằng thì về lâu dài số nào cũng ra số lần gần bằng nhau. Mức trung bình là số lần mỗi số "đáng lẽ" ra, tính bằng: số kỳ nhân số quả quay mỗi kỳ, chia cho tổng số quả trong lồng.</p>',
      ex: 'Lotto 5/35 quay 1.000 kỳ, mỗi kỳ 5 số trong 35 số: mỗi số trung bình ra 1.000 × 5 ÷ 35 ≈ 143 lần.' },
    { id: 'lech', group: 'ket-qua', name: 'Nhiều hơn, ít hơn trung bình (ô đỏ, ô xanh)',
      text: '<p>Không số nào ra đúng bằng mức trung bình. Do may rủi, có số ra nhiều hơn một chút (ô đỏ), có số ra ít hơn (ô xanh). Màu càng đậm là lệch càng nhiều.</p>' +
        '<p>Ứng dụng gọi tên bốn mức: <b>gần mức trung bình</b>, <b>hơi lệch</b> (vẫn bình thường), <b>lệch nhiều</b>, <b>lệch rất nhiều</b>. Vì có mấy chục số cùng lúc nên luôn có vài ô đậm màu, đó là chuyện bình thường.</p>',
      ex: 'Số 22 ra 167 lần trong khi trung bình là 143 lần: nhiều hơn 24 lần, ô đỏ đậm. Điều đó không làm số 22 dễ ra hơn ở kỳ sau.' },
    { id: 'so-gan', group: 'ket-qua', name: 'Số gan (số kỳ chưa ra)',
      text: '<p>Số kỳ liên tiếp gần đây mà một số chưa xuất hiện. Số gan lớn chỉ cho biết số đó đang vắng lâu, không cho biết nó sắp ra: mỗi kỳ máy quay lại từ đầu, cơ hội của mọi số như nhau.</p>',
      ex: 'Số 32 gan 29 kỳ nghĩa là 29 kỳ gần nhất không kỳ nào có số 32. Ở Lotto 5/35, trung bình một số ra lại sau 7 kỳ, nhưng vắng hai ba chục kỳ vẫn thường gặp.' },
    { id: 'nong-lanh', group: 'ket-qua', name: 'Số nóng, số lạnh',
      text: '<p>Số nóng là số ra nhiều hơn trung bình trong một khoảng thời gian, số lạnh là số ra ít hơn. Đây là cách mô tả những gì đã xảy ra.</p>' +
        '<p>Ứng dụng đã thử trên toàn bộ lịch sử: mua theo số nóng hay theo số lạnh đều không trúng nhiều hơn chọn bừa (xem mục Kiểm chứng).</p>' },
    { id: 'doc-lap', group: 'ket-qua', name: 'Các kỳ quay không liên quan đến nhau',
      text: '<p>Lồng cầu không nhớ kỳ trước ra số gì. Vì vậy số vừa ra, số lâu chưa ra, số ra nhiều hay ra ít đều có cùng cơ hội ở kỳ tới.</p>' +
        '<p>Mọi thống kê trong ứng dụng là để hiểu những gì đã xảy ra và để kiểm tra máy quay có công bằng không, không phải để đoán trước kết quả.</p>' },
    { id: 'so-dac-biet', group: 'ket-qua', name: 'Số đặc biệt (quả màu vàng)',
      text: '<p><b>Power 6/55:</b> sau 6 số chính, máy quay thêm 1 số từ các quả còn lại. Số này chỉ dùng cho giải Jackpot 2 (trùng 5 số chính và số đặc biệt).</p>' +
        '<p><b>Lotto 5/35:</b> bạn chọn thêm 1 số đặc biệt từ 1 đến 12, quay ở lồng riêng.</p><p><b>Mega 6/45:</b> không có số đặc biệt.</p>' },
    { id: 'cap-so', group: 'ket-qua', name: 'Cặp số ra cùng nhau',
      text: '<p>Hai số cùng có mặt trong một kỳ quay được tính là ra cùng nhau một lần. Mục Cặp số đếm số lần đó cho mọi cặp.</p>' +
        '<p>Cặp hay ra cùng nhau trong quá khứ không có cơ hội cao hơn ở kỳ sau: khi chia lịch sử làm hai nửa, những cặp đi cùng nhiều ở nửa đầu không còn đi cùng nhiều ở nửa sau.</p>' },

    /* ------------------------------------------------ cơ hội trúng và tiền thưởng */
    { id: 'co-hoi', group: 'tien', name: 'Cơ hội "1 trên N"',
      text: '<p>Cách nói dễ hình dung của xác suất: trong N vé khác nhau có đúng 1 vé trúng. N càng lớn thì càng khó trúng. Mua thêm vé khác nhau thì cơ hội tăng đúng theo số vé: 10 vé là 10 trên N.</p>',
      ex: 'Giải Độc Đắc Lotto 5/35 là 1 trên 3.895.584. Nếu kỳ nào cũng mua 1 vé (2 kỳ mỗi ngày) thì trung bình hơn 5.000 năm mới trúng một lần.' },
    { id: 'nhan-lai', group: 'tien', name: 'Trung bình một vé nhận lại',
      text: '<p>Lấy tổng tiền thưởng của mọi hạng giải chia đều cho tất cả các vé có thể mua: đó là số tiền một vé nhận lại nếu tính trung bình. Con số này luôn được so với giá vé 10.000đ. (Sách thống kê gọi là giá trị kỳ vọng.)</p>' +
        '<p>Lưu ý: đây là con số trung bình. Trên thực tế phần lớn người mua nhận 0đ, một số rất ít người nhận rất nhiều.</p>',
      ex: 'Trung bình nhận lại 4.900đ nghĩa là: mua thật nhiều vé thì cứ mỗi vé 10.000đ thu về khoảng 4.900đ, tức mất khoảng một nửa số tiền.' },
    { id: 'hoa-von', group: 'tien', name: 'Hòa vốn',
      text: '<p>Mức mà trung bình một vé nhận lại đúng bằng giá vé 10.000đ. Chỉ khi giải cao nhất tích lũy lên rất lớn thì mới chạm mức này. Càng nhiều người mua thì càng khó, vì giải lớn có thể phải chia cho nhiều người cùng trúng.</p>',
      ex: 'Nếu ứng dụng ghi "hòa vốn khi Độc Đắc khoảng 37 tỷ" mà Độc Đắc đang là 14 tỷ thì tính trung bình, mỗi vé vẫn lỗ.' },
    { id: 'chia-giai', group: 'tien', name: 'Kỳ chia giải (Lotto 5/35)',
      text: '<p>Khi giải Độc Đắc vượt 12 tỷ đồng mà chưa có người trúng, kỳ quay 21h của ngày kế tiếp là kỳ chia giải. Nếu kỳ đó vẫn không ai trúng Độc Đắc thì toàn bộ tiền Độc Đắc được chia xuống các giải thấp hơn: giải Nhất nhận 1/3; các giải Nhì, Ba, Tư, Năm mỗi giải nhận 1/6.</p>' +
        '<p>Vì vậy ở kỳ chia giải, trung bình một vé nhận lại cao hơn hẳn kỳ thường. Nhưng phần lớn giá trị vẫn nằm ở các giải rất khó trúng, nên đa số người mua ít vé vẫn lỗ.</p>' },
    { id: 'chia-jackpot', group: 'tien', name: 'Nhiều người cùng trúng thì chia giải',
      text: '<p>Giải Độc Đắc và Jackpot là một khoản tiền chung: có 2 vé cùng trúng thì mỗi vé nhận một nửa. Chọn những số ít người chọn không làm bạn dễ trúng hơn, nhưng nếu trúng thì ít phải chia.</p>' },
    { id: 'thue', group: 'tien', name: 'Thuế khi trúng thưởng',
      text: '<p>Tiền thưởng trên 10 triệu đồng phải nộp thuế thu nhập 10% cho phần vượt quá 10 triệu. Các con số "sau thuế" trong ứng dụng đã trừ khoản này.</p>',
      ex: 'Trúng 30 triệu: nộp 10% của 20 triệu là 2 triệu, thực nhận 28 triệu.' },
    { id: 'thu-ve', group: 'tien', name: 'Thu về trên mỗi 100.000đ',
      text: '<p>Cách ứng dụng nói về lãi lỗ: bỏ ra 100.000đ mua vé thì tổng tiền trúng là bao nhiêu. Dưới 100.000đ là lỗ, trên 100.000đ là lãi.</p>',
      ex: 'Thu về 14.000đ nghĩa là bỏ 100.000đ mua vé, trúng tổng cộng 14.000đ, lỗ 86.000đ.' },
    { id: 'uoc-tinh', group: 'tien', name: 'Số ước tính (có dấu ≈)',
      text: '<p>Vietlott không công bố trước giá trị giải cao nhất của kỳ sắp quay và số vé bán ra. Ứng dụng suy ra từ các kỳ gần nhất: giải kỳ tới từ mức tăng thường thấy giữa hai kỳ, số vé bán ra từ số người trúng giải nhỏ nhất. Các số có dấu ≈ là số ước tính, có thể lệch so với số chính thức.</p>' },

    /* ------------------------------------------------ kiểm tra độ ngẫu nhiên */
    { id: 'kiem-tra', group: 'kiem-tra', name: 'Phép kiểm tra độ ngẫu nhiên',
      text: '<p>Mỗi phép kiểm tra là một câu hỏi về kết quả quay, ví dụ "các số có ra đều nhau không?" hay "kết quả kỳ này có liên quan đến kỳ trước không?". Ứng dụng so dữ liệu thật với điều lẽ ra phải thấy nếu máy quay hoàn toàn ngẫu nhiên, rồi kết luận một trong ba mức:</p>' +
        '<p><b>Bình thường:</b> không có gì khác với quay ngẫu nhiên. <b>Cần theo dõi:</b> hơi khác thường, chờ thêm dữ liệu. <b>Bất thường:</b> rất khó xảy ra nếu quay ngẫu nhiên.</p>' },
    { id: 'de-gap', group: 'kiem-tra', name: 'Dễ gặp cỡ nào nếu quay ngẫu nhiên',
      text: '<p>Với mỗi phép kiểm tra, ứng dụng tính: nếu máy quay hoàn toàn ngẫu nhiên thì bao nhiêu phần trăm số lần vẫn thấy mức lệch lớn như trong dữ liệu thật.</p>' +
        '<p>Con số lớn nghĩa là chuyện thường gặp, không có gì đáng ngờ. Dưới 5% mới đáng để ý, dưới 1% là hiếm. (Sách thống kê gọi con số này là giá trị p.)</p>',
      ex: '27% nghĩa là cứ 4 lần quay ngẫu nhiên thì hơn 1 lần cho kết quả lệch cỡ đó: hoàn toàn bình thường.' },
    { id: 'nhieu-lan', group: 'kiem-tra', name: 'Thử nhiều lần thì dễ gặp may',
      text: '<p>Làm một phép kiểm tra thì hiếm khi gặp kết quả "dưới 5%". Nhưng làm 25 phép cùng lúc thì dù máy quay công bằng, trung bình vẫn có 1 đến 2 phép rơi vào mức đó chỉ do may rủi.</p>' +
        '<p>Vì vậy khi xét nhiều phép kiểm tra, nhiều số, nhiều cặp số hay nhiều cách chọn số cùng lúc, ứng dụng nâng mức đòi hỏi lên và chỉ kết luận sau khi đã tính điều này. (Tên kỹ thuật: hiệu chỉnh Holm, Benjamini–Hochberg.)</p>',
      ex: 'Trong 595 cặp số của Lotto 5/35, quay ngẫu nhiên đã tự sinh ra khoảng 30 cặp trông "bất thường". Nếu đếm được 33 cặp như vậy thì chưa nói lên điều gì.' },
    { id: 'khoang', group: 'kiem-tra', name: 'Khoảng dao động',
      text: '<p>Một con số đo từ dữ liệu luôn có sai số. Khoảng dao động cho biết giá trị thật nhiều khả năng nằm trong đoạn nào. Nếu đoạn này chứa mốc của chọn bừa thì chưa thể nói là khác chọn bừa. (Tên kỹ thuật: khoảng tin cậy 95%.)</p>',
      ex: 'Trung bình mỗi vé trùng 0,68 số, khoảng dao động từ 0,63 đến 0,73. Mốc chọn bừa 0,71 nằm trong khoảng đó: không khác chọn bừa.' },
    { id: 'mo-phong', group: 'kiem-tra', name: 'Mô phỏng (máy tính quay thử)',
      text: '<p>Máy tính tự quay thử hàng chục nghìn kỳ ngẫu nhiên, hoặc đóng vai hàng nghìn người chơi chọn bừa, để xem chuyện gì thường xảy ra. Kết quả mô phỏng được dùng làm mốc so sánh và để kiểm tra lại các công thức. Mô phỏng luôn chạy theo cùng một trình tự nên mở lại vẫn ra đúng con số cũ.</p>' },

    /* ------------------------------------------------ cách chọn số và kiểm chứng */
    { id: 'cach-chon', group: 'chon-so', name: 'Cách chọn số',
      text: '<p>Một quy tắc cố định để chọn vé từ dữ liệu các kỳ trước. Ví dụ: chọn các số ra nhiều nhất, chọn các số lâu chưa ra, chọn các số ít người chọn. Ứng dụng có 15 cách như vậy và một cách chọn bừa làm mốc so sánh.</p>' },
    { id: 'chon-bua', group: 'chon-so', name: 'Chọn bừa (chọn ngẫu nhiên)',
      text: '<p>Để máy chọn số hoàn toàn ngẫu nhiên, không dựa vào thống kê nào. Đây là mốc so sánh: một cách chọn số chỉ có giá trị nếu trúng nhiều hơn chọn bừa một cách rõ ràng.</p>' },
    { id: 'kiem-chung', group: 'chon-so', name: 'Kiểm chứng trên các kỳ đã quay',
      text: '<p>Quay ngược thời gian: với từng kỳ đã quay, ứng dụng chỉ dùng kết quả của các kỳ trước đó để chọn vé theo một cách chọn số, rồi so với kết quả thật của kỳ ấy. Làm vậy cho hàng trăm kỳ thì biết cách chọn đó trúng nhiều hay ít.</p>' +
        '<p>Vì không dùng kết quả "tương lai" nên phép thử này không tự lừa mình. (Tên kỹ thuật: backtest.)</p>' },
    { id: 'so-trung', group: 'chon-so', name: 'Số quả trùng mỗi vé',
      text: '<p>Số quả trong một vé trùng với kết quả của kỳ quay. Lấy trung bình qua nhiều kỳ để so các cách chọn số với nhau: cách nào tốt thật thì con số này phải cao hơn chọn bừa một cách rõ ràng.</p>',
      ex: 'Lotto 5/35: vé chọn bừa trùng trung bình 0,71 số mỗi kỳ (5 × 5 ÷ 35).' },
    { id: 'diem', group: 'chon-so', name: 'Điểm của bộ số (0 đến 100)',
      text: '<p>Cho biết bộ số hợp với tiêu chí của một cách chọn số đến đâu, bằng cách so với các bộ số chọn bừa. 50 điểm là ở giữa; 90 điểm là hợp hơn 90 trong 100 bộ chọn bừa.</p>' +
        '<p><b>Điểm không phải là khả năng trúng.</b> Mọi bộ số đều có cùng cơ hội trúng, dù điểm cao hay thấp.</p>' },
    { id: 'do-phu', group: 'chon-so', name: 'Phủ rộng và vé trùng nhau',
      text: '<p>Khi mua nhiều vé: phủ rộng nghĩa là các vé dùng nhiều số khác nhau, ít trùng nhau. Khi đó kỳ nào cũng dễ có ít nhất một vé trúng giải nhỏ hơn. Ngược lại, các vé giống nhau nhiều thì hiếm khi trúng, nhưng khi trúng thì nhiều vé cùng trúng.</p>' +
        '<p>Cách nào thì tổng tiền thưởng tính trung bình cũng như nhau, và cơ hội giải cao nhất cũng như nhau.</p>' },
    { id: 'ua-chuong', group: 'chon-so', name: 'Số được nhiều người chọn',
      text: '<p>Người chơi không chọn đều các số: số nhỏ (ngày sinh), số đẹp thường được chọn nhiều hơn. Ứng dụng ước lượng điều này từ số người trúng thật của từng kỳ.</p>' +
        '<p>×1,00 là mức trung bình. ×1,20 là được chọn nhiều hơn mức trung bình 20%; ×0,80 là ít hơn 20%. Chọn số ít người chọn không tăng cơ hội trúng, chỉ giúp ít phải chia giải lớn nếu trúng.</p>' },

    /* ------------------------------------------------ số liệu kỹ thuật */
    { id: 'p', group: 'ky-thuat', name: 'p, p hiệu chỉnh, q',
      text: '<p><b>p</b> là tên kỹ thuật của "dễ gặp cỡ nào nếu quay ngẫu nhiên". <b>p hiệu chỉnh</b> là giá trị p sau khi đã tính việc làm nhiều phép kiểm tra cùng lúc (phương pháp Holm). <b>q</b> là con số tương tự theo phương pháp Benjamini–Hochberg. Cả ba: dưới 5% mới đáng để ý.</p>' },
    { id: 'z', group: 'ky-thuat', name: 'σ (độ lệch chuẩn) và z',
      text: '<p><b>Độ lệch chuẩn (σ)</b> là cỡ dao động thường gặp do may rủi. <b>z</b> là mức lệch tính bằng số lần độ lệch chuẩn: dấu cộng là cao hơn trung bình, dấu trừ là thấp hơn trung bình.</p>' +
        '<p>Cách đổi sang lời của ứng dụng: dưới 1 là gần mức trung bình, 1 đến 2 là hơi lệch, 2 đến 3 là lệch nhiều, trên 3 là lệch rất nhiều.</p>',
      ex: 'z = −1,5 nghĩa là thấp hơn trung bình 1,5 lần độ lệch chuẩn: hơi lệch, vẫn bình thường.' },
    { id: 'auc', group: 'ky-thuat', name: 'AUC',
      text: '<p>Đo khả năng xếp hạng của một cách chọn số. Lấy một số có ra và một số không ra ở kỳ tới: AUC là tỷ lệ số lần cách chọn đó xếp số có ra lên trên. 0,5 là như tung đồng xu (không có giá trị dự báo), 1 là luôn đúng.</p>' },
    { id: 'lift', group: 'ky-thuat', name: 'Lift, support, confidence',
      text: '<p>Ba thước đo của một cặp số. <b>Support:</b> tỷ lệ kỳ có cả hai số. <b>Confidence a→b:</b> trong các kỳ có số a, tỷ lệ kỳ có cả số b. <b>Lift:</b> số lần cặp ra cùng nhau chia cho mức trung bình; lift 1,5 là nhiều gấp rưỡi trung bình.</p>' },
    { id: 'bayes', group: 'ky-thuat', name: 'Ước lượng Bayes',
      text: '<p>Cách ước lượng tần suất thật của một số bằng cách kết hợp dữ liệu với giả định ban đầu rằng máy quay công bằng. Dữ liệu càng ít thì ước lượng càng bị kéo về mức lý thuyết, nhờ đó không vội kết luận từ vài chục kỳ.</p>' },
    { id: 'trung-vi', group: 'ky-thuat', name: 'Trung vị',
      text: '<p>Giá trị đứng giữa khi xếp các số liệu từ nhỏ đến lớn: một nửa nhỏ hơn, một nửa lớn hơn. Khác với trung bình cộng, trung vị không bị kéo lệch bởi vài giá trị rất lớn.</p>',
      ex: 'Trong 2.000 người chọn bừa, "người ở giữa" là người có kết quả đúng bằng trung vị.' }
  ]
};
